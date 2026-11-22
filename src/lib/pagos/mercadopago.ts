/**
 * Mercado Pago · Checkout Pro (PSE, tarjetas, Efecty…). Sin dependencias: se usa la API REST.
 * Documentación: https://www.mercadopago.com.co/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post
 *
 *  * Para pagar se crea una «preferencia» con la referencia de la orden (external_reference) y el
 *    valor; Mercado Pago devuelve el enlace (init_point) a su página de pago.
 *  * Un pago se da por bueno SOLO consultándolo en la API de Mercado Pago con la llave privada
 *    (GET /v1/payments/{id}): debe estar «approved», con nuestra referencia y el valor exacto.
 *    Así ni un aviso falso ni una URL de regreso alterada pueden marcar un pago.
 *  * El aviso (webhook) solo dice «consulta el pago X». Si está el secreto del webhook, además
 *    se revisa su firma (x-signature).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";

export interface MercadoPagoConfig {
  /** Llave privada («Access Token»). Nunca sale del servidor. */
  accessToken: string;
  /** Clave secreta del webhook (Tus integraciones → Webhooks). Opcional pero recomendada. */
  webhookSecret?: string;
}

export function mercadoPagoConfig(env: Record<string, string | undefined> = process.env): MercadoPagoConfig | null {
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;
  return { accessToken, webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || undefined };
}

export interface OrdenPago {
  reference: string;
  /** Valor total en pesos (sin centavos). */
  amount: number;
  title: string;
  /** Adónde vuelve el comercio después de pagar (Mercado Pago agrega payment_id y status). */
  returnUrl: string;
  notificationUrl: string;
  email?: string;
}

/** Cuerpo de la preferencia de Checkout Pro. */
export function preferenceBody(o: OrdenPago) {
  return {
    items: [{ id: o.reference, title: o.title, quantity: 1, currency_id: "COP", unit_price: o.amount }],
    external_reference: o.reference,
    back_urls: { success: o.returnUrl, pending: o.returnUrl, failure: o.returnUrl },
    auto_return: "approved",
    notification_url: o.notificationUrl,
    statement_descriptor: "LAZO",
    ...(o.email ? { payer: { email: o.email } } : {}),
  };
}

async function api<T>(cfg: MercadoPagoConfig, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mercado Pago ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Crea la preferencia y devuelve el enlace a la página de pago de Mercado Pago. */
export async function createPreference(cfg: MercadoPagoConfig, o: OrdenPago): Promise<string> {
  const p = await api<{ id: string; init_point?: string; sandbox_init_point?: string }>(cfg, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(preferenceBody(o)),
    headers: { "X-Idempotency-Key": o.reference },
  });
  const url = p.init_point ?? p.sandbox_init_point;
  if (!url) throw new Error("Mercado Pago no devolvió el enlace de pago");
  return url;
}

export interface PagoMP {
  id: number | string;
  status: string;
  external_reference: string | null;
  transaction_amount: number | string;
  currency_id: string;
}

/** Consulta un pago con la llave privada: es la única fuente de verdad. */
export const getPayment = (cfg: MercadoPagoConfig, id: string) => api<PagoMP>(cfg, `/v1/payments/${encodeURIComponent(id)}`);

/** Estado de Mercado Pago → estado de nuestra orden. */
export function estadoOrden(status: string): "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "rejected":
      return "DECLINED";
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "VOIDED";
    case "pending":
    case "in_process":
    case "authorized":
    case "in_mediation":
      return "PENDING";
    default:
      return "ERROR";
  }
}

/** Valor del pago en centavos (Mercado Pago lo da en pesos, a veces como texto). */
export const centavos = (amount: number | string) => Math.round(Number(amount) * 100);

/** ¿Es un id de pago válido para consultar? (solo dígitos o letras, sin rutas raras) */
export const idValido = (id: string | null | undefined): id is string => !!id && /^[A-Za-z0-9-]{1,40}$/.test(id);

/**
 * Firma del aviso (x-signature: "ts=…,v1=…"): HMAC-SHA256 con la clave secreta del webhook sobre
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (se omiten las partes que no lleguen).
 * Es una capa extra: el pago igual se confirma consultando la API.
 */
export function verifySignature(secret: string, o: { signature: string | null; requestId: string | null; dataId: string | null }): boolean {
  if (!o.signature) return false;
  const partes = Object.fromEntries(
    o.signature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  let manifest = "";
  if (o.dataId) manifest += `id:${/^[a-z0-9]+$/i.test(o.dataId) ? o.dataId.toLowerCase() : o.dataId};`;
  if (o.requestId) manifest += `request-id:${o.requestId};`;
  manifest += `ts:${ts};`;
  const esperado = Buffer.from(createHmac("sha256", secret).update(manifest).digest("hex"));
  const recibido = Buffer.from(v1.toLowerCase());
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
