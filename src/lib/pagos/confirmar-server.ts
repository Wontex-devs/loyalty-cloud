import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { centavos, estadoOrden, getPayment, idValido, mercadoPagoConfig } from "./mercadopago";

/**
 * Confirma un pago de Mercado Pago consultándolo en su API con la llave privada (la única fuente
 * de verdad) y se lo pasa a la base de datos, que lo registra una sola vez si está aprobado y el
 * valor coincide con la orden. Lo usan el aviso (webhook) y el regreso del comercio a su panel.
 */
export async function confirmarPagoMercadoPago(paymentId: string): Promise<{ ok: boolean; resultado?: string; referencia?: string }> {
  const cfg = mercadoPagoConfig();
  if (!cfg || !idValido(paymentId)) return { ok: false };
  const pago = await getPayment(cfg, paymentId);
  const referencia = pago.external_reference ?? "";
  if (!referencia.startsWith("lazo-")) return { ok: true, resultado: "ajena" };
  const estado = pago.currency_id === "COP" ? estadoOrden(pago.status) : "ERROR";
  const { data, error } = await createAdminClient().rpc("confirm_online_payment", {
    p_reference: referencia,
    p_transaction_id: `mp-${pago.id}`,
    p_status: estado,
    p_amount_cents: centavos(pago.transaction_amount),
  });
  if (error) throw new Error(`confirm_online_payment: ${error.message}`);
  if (data === "mismatch") console.error("[mercadopago] el valor pagado no coincide con la orden", referencia);
  return { ok: true, resultado: data as string, referencia };
}
