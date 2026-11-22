/**
 * Wompi (pagos en línea en Colombia: PSE, Nequi, tarjeta…). Sin dependencias.
 * Documentación: https://docs.wompi.co/docs/colombia/widget-checkout-web/ y /eventos/
 *
 *  * El pago se hace en el Web Checkout de Wompi: un enlace con la referencia, el valor en
 *    centavos y una firma de integridad (SHA256) que solo se calcula en el servidor.
 *  * La confirmación llega por el aviso «transaction.updated» que Wompi envía al servidor.
 *    Su firma se verifica con el secreto de eventos; la redirección al panel es solo informativa.
 *  * Las llaves de pruebas empiezan por pub_test_ / test_integrity_ / test_events_ y las de
 *    producción por pub_prod_ / prod_integrity_ / prod_events_.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export interface WompiConfig {
  publicKey: string;
  integritySecret: string;
  /** Sin él no se aceptan avisos: el pago quedaría sin confirmar. */
  eventsSecret?: string;
}

export function wompiConfig(env: Record<string, string | undefined> = process.env): WompiConfig | null {
  const publicKey = env.WOMPI_PUBLIC_KEY?.trim();
  const integritySecret = env.WOMPI_INTEGRITY_SECRET?.trim();
  if (!publicKey || !integritySecret) return null;
  return { publicKey, integritySecret, eventsSecret: env.WOMPI_EVENTS_SECRET?.trim() || undefined };
}

/** ¿Es el ambiente de pruebas de Wompi? (no cobra de verdad) */
export const isSandbox = (cfg: Pick<WompiConfig, "publicKey">) => cfg.publicKey.startsWith("pub_test_");

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Firma de integridad: SHA256 de referencia + valor en centavos + moneda + secreto de integridad. */
export function integritySignature(reference: string, amountInCents: number, currency: string, secret: string) {
  return sha256(`${reference}${amountInCents}${currency}${secret}`);
}

/** Enlace al Web Checkout de Wompi. Wompi agrega «?id=<transacción>» al volver a redirectUrl. */
export function checkoutUrl(
  cfg: Pick<WompiConfig, "publicKey" | "integritySecret">,
  o: { reference: string; amountInCents: number; redirectUrl: string; email?: string },
) {
  const q = new URLSearchParams({
    "public-key": cfg.publicKey,
    currency: "COP",
    "amount-in-cents": String(o.amountInCents),
    reference: o.reference,
    "signature:integrity": integritySignature(o.reference, o.amountInCents, "COP", cfg.integritySecret),
    "redirect-url": o.redirectUrl,
  });
  if (o.email) q.set("customer-data:email", o.email);
  return `https://checkout.wompi.co/p/?${q.toString()}`;
}

export interface WompiTransaction {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
  reference: string;
  amount_in_cents: number;
  currency?: string;
}

export interface WompiEvent {
  event: string;
  data: { transaction?: WompiTransaction } & Record<string, unknown>;
  environment?: "prod" | "test";
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

/** Lee «transaction.id» dentro de data. */
function prop(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), data);
}

/**
 * Verifica la firma de un aviso de Wompi: SHA256 de los valores de signature.properties (en orden,
 * leídos de data), el timestamp y el secreto de eventos. Se compara con signature.checksum y, si
 * llega, con el encabezado X-Event-Checksum. La lista de propiedades se lee de cada aviso.
 */
export function verifyEvent(body: unknown, eventsSecret: string, headerChecksum?: string | null): body is WompiEvent {
  if (!body || typeof body !== "object") return false;
  const e = body as Partial<WompiEvent>;
  const props = e.signature?.properties;
  const checksum = e.signature?.checksum;
  if (!Array.isArray(props) || !props.length || typeof checksum !== "string" || typeof e.timestamp !== "number") return false;
  const values = props.map((p) => prop(e.data, p));
  if (values.some((v) => v === undefined || v === null || typeof v === "object")) return false;
  const expected = sha256(`${values.map(String).join("")}${e.timestamp}${eventsSecret}`);
  const same = (got: string) => {
    const a = Buffer.from(expected.toLowerCase());
    const b = Buffer.from(got.trim().toLowerCase());
    return a.length === b.length && timingSafeEqual(a, b);
  };
  return same(checksum) && (!headerChecksum || same(headerChecksum));
}
