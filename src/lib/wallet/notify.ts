import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleWalletConfig } from "./config";
import { addMessage } from "./google";
import type { Notice } from "./messages";

export interface QueuedNotice {
  id: string;
  token: string;
  title: string;
  body: string;
}

const fit = (n: Notice) => ({ kind: n.kind, title: n.title.slice(0, 60), body: n.body.slice(0, 300) });

/**
 * Registra avisos una sola vez (card_id + ref) con la service_role y devuelve
 * solo los nuevos: un reintento de la visita o del proceso diario no repite el aviso.
 */
export async function queueNotices(rows: { businessId: string; cardId: string; token: string; ref: string; notice: Notice }[]): Promise<QueuedNotice[]> {
  if (!rows.length) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallet_notifications")
    .upsert(
      rows.map((r) => ({ business_id: r.businessId, card_id: r.cardId, ref: r.ref, ...fit(r.notice) })),
      { onConflict: "card_id,ref", ignoreDuplicates: true },
    )
    .select("id, card_id, title, body");
  if (error) throw new Error(`wallet_notifications: ${error.message}`);
  const tokenOf = new Map(rows.map((r) => [r.cardId, r.token]));
  return (data ?? []).map((d) => ({ id: d.id, token: tokenOf.get(d.card_id) ?? "", title: d.title, body: d.body }));
}

/**
 * Entrega los avisos a las billeteras y guarda el resultado de cada uno.
 * Sin Google Wallet configurado quedan como "not_saved" (no hay a dónde enviarlos).
 */
export async function deliverNotices(notices: QueuedNotice[]) {
  const counts = { sent: 0, notSaved: 0, failed: 0 };
  if (!notices.length) return counts;
  const cfg = googleWalletConfig();
  const status = new Map<string, "sent" | "not_saved" | "failed">();

  // De a 8 en paralelo: rápido para una campaña sin saturar la API de Google.
  for (let i = 0; i < notices.length; i += 8) {
    await Promise.all(
      notices.slice(i, i + 8).map(async (n) => {
        if (!cfg || !n.token) return void status.set(n.id, "not_saved");
        try {
          status.set(n.id, (await addMessage(cfg, n.token, n)) ? "sent" : "not_saved");
        } catch (e) {
          console.error("[wallet] no se pudo enviar el aviso", e);
          status.set(n.id, "failed");
        }
      }),
    );
  }

  const admin = createAdminClient();
  for (const s of ["sent", "not_saved", "failed"] as const) {
    const ids = notices.filter((n) => status.get(n.id) === s).map((n) => n.id);
    if (!ids.length) continue;
    await admin.from("wallet_notifications").update({ status: s }).in("id", ids);
    counts[s === "sent" ? "sent" : s === "not_saved" ? "notSaved" : "failed"] = ids.length;
  }
  return counts;
}
