import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBusiness, getPublicCard } from "@/lib/data/public";
import { googleWalletConfig } from "./config";
import { updateClass, updateObject } from "./google";
import { visitNotice, walletSettings } from "./messages";
import { deliverNotices, queueNotices } from "./notify";
import { passFromCard } from "./pass";

/** Datos de una visita recién registrada, para su aviso (sello nuevo, te falta 1 o premio listo). */
export interface VisitNoticeInput {
  idempotencyKey: string;
  rewardEarned: boolean;
  birthdayReward: boolean;
}

const origin = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

/**
 * Actualiza los pases de billetera de una tarjeta después de responder (no frena la caja)
 * y, tras una visita, le envía su aviso. Si el cliente no guardó el pase, Google responde 404.
 */
export function scheduleCardWalletSync(cardId: string, visit?: VisitNoticeInput, opts?: { service?: boolean }) {
  if (!googleWalletConfig()) return;
  after(async () => {
    try {
      // El toque NFC no trae sesión de empleado: ahí se lee la tarjeta con la clave del servidor.
      const supabase = opts?.service ? createAdminClient() : await createClient();
      const { data } = await supabase.from("loyalty_cards").select("public_token, business_id").eq("id", cardId).maybeSingle();
      if (!data?.public_token) return;
      const card = await getPublicCard(data.public_token);
      const cfg = googleWalletConfig();
      if (!card || !cfg) return;
      const saved = await updateObject(cfg, passFromCard(card, origin()));
      if (visit && saved) await notifyVisit(cardId, data.business_id, card, visit);
    } catch (e) {
      console.error("[wallet] no se pudo actualizar el pase", e);
    }
  });
}

async function notifyVisit(
  cardId: string,
  businessId: string,
  card: NonNullable<Awaited<ReturnType<typeof getPublicCard>>>,
  visit: VisitNoticeInput,
) {
  const { data: biz } = await createAdminClient().from("businesses").select("wallet_notifications").eq("id", businessId).maybeSingle();
  const rewards = card.rewards;
  const notice = visitNotice(walletSettings(biz?.wallet_notifications), {
    businessName: card.business.name,
    stamps: Math.min(card.stamps, card.program.stampsRequired),
    required: card.program.stampsRequired,
    rewardName: card.program.rewardName,
    rewardEarned: visit.rewardEarned ? (rewards.find((r) => r.kind !== "birthday")?.name ?? card.program.rewardName) : null,
    birthdayReward: visit.birthdayReward ? (rewards.find((r) => r.kind === "birthday")?.name ?? "regalo de cumpleaños") : null,
  });
  if (!notice) return;
  const queued = await queueNotices([{ businessId, cardId, token: card.token, ref: `visit:${visit.idempotencyKey}`, notice }]);
  await deliverNotices(queued);
}

/** Actualiza el diseño común (nombre, logo, color) cuando el comercio cambia su marca o programa. */
export function scheduleBusinessWalletSync(businessId: string) {
  if (!googleWalletConfig()) return;
  after(async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("businesses").select("slug").eq("id", businessId).maybeSingle();
      const b = data?.slug ? await getPublicBusiness(data.slug) : null;
      const cfg = googleWalletConfig();
      if (!b || !cfg) return;
      await updateClass(cfg, {
        business: {
          name: b.name,
          slug: b.slug,
          logoText: b.branding.logoText,
          background: b.branding.cardBackground,
          foreground: b.branding.cardForeground,
          logoUrl: `${origin()}/join/${b.slug}/icon/660`,
          coverUrl: b.branding.coverUrl || undefined,
        },
        program: { name: b.program.name, stampsRequired: b.program.stampsRequired, rewardName: b.program.rewardName },
      });
    } catch (e) {
      console.error("[wallet] no se pudo actualizar el diseño del pase", e);
    }
  });
}
