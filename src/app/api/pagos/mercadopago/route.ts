import { NextResponse } from "next/server";
import { idValido, mercadoPagoConfig, verifySignature } from "@/lib/pagos/mercadopago";
import { confirmarPagoMercadoPago } from "@/lib/pagos/confirmar-server";

/**
 * Avisos de Mercado Pago (se envían a la notification_url de cada pago; también se puede poner en
 * Tus integraciones → Webhooks, evento «Pagos»): https://<dominio>/api/pagos/mercadopago
 * El aviso solo dice qué pago consultar: el pago se confirma preguntándole a la API de Mercado Pago.
 * Si está la clave secreta del webhook, primero se revisa la firma.
 * Se responde 200 a todo aviso válido; si algo falla de nuestro lado, 500 para que lo reintente.
 */
export async function POST(req: Request) {
  const cfg = mercadoPagoConfig();
  if (!cfg) return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });

  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { type?: string; topic?: string; data?: { id?: string | number } } | null;
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? body?.topic ?? "";
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body?.data?.id != null ? String(body.data.id) : null);

  if (cfg.webhookSecret && !verifySignature(cfg.webhookSecret, { signature: req.headers.get("x-signature"), requestId: req.headers.get("x-request-id"), dataId })) {
    console.warn("[mercadopago] aviso con firma inválida");
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (tipo !== "payment" || !idValido(dataId)) return NextResponse.json({ ok: true, ignored: tipo || "sin-tipo" });

  try {
    const r = await confirmarPagoMercadoPago(dataId);
    return NextResponse.json({ ok: true, result: r.resultado });
  } catch (e) {
    console.error("[mercadopago] no se pudo confirmar el pago", dataId, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
