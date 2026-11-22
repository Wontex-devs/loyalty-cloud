import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEvent, wompiConfig } from "@/lib/pagos/wompi";

/**
 * Avisos de Wompi (configurar esta URL en el panel de Wompi → Desarrolladores → URL de eventos):
 *   https://<dominio>/api/pagos/wompi
 * Solo se cree un aviso con la firma correcta. Si el pago quedó aprobado y el valor coincide con
 * la orden, la base de datos registra el pago una sola vez (aunque Wompi repita el aviso).
 * Wompi reintenta si no recibe 200: se responde 200 a todo aviso válido, también a los que se ignoran.
 */
export async function POST(req: Request) {
  const cfg = wompiConfig();
  if (!cfg?.eventsSecret) return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!verifyEvent(body, cfg.eventsSecret, req.headers.get("x-event-checksum"))) {
    console.warn("[wompi] aviso con firma inválida");
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (body.event !== "transaction.updated" || !body.data.transaction) return NextResponse.json({ ok: true, ignored: body.event });

  const t = body.data.transaction;
  if (!String(t.reference ?? "").startsWith("lazo-")) return NextResponse.json({ ok: true, ignored: "reference" });
  const { data, error } = await createAdminClient().rpc("confirm_online_payment", {
    p_reference: t.reference,
    p_transaction_id: t.id,
    p_status: t.status,
    p_amount_cents: t.amount_in_cents,
  });
  if (error) {
    // Error de nuestro lado: Wompi reintenta más tarde.
    console.error("[wompi] no se pudo confirmar", t.reference, error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (data === "mismatch") console.error("[wompi] el valor pagado no coincide con la orden", t.reference);
  return NextResponse.json({ ok: true, result: data });
}
