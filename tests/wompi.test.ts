// Wompi: firma de integridad del enlace de pago y verificación de los avisos (ejemplos de la documentación).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutUrl, integritySignature, isSandbox, verifyEvent, wompiConfig } from "../src/lib/pagos/wompi.ts";

test("firma de integridad: el ejemplo de la documentación de Wompi", () => {
  assert.equal(
    integritySignature("sk8-438k4-xmxm392-sn2m", 2490000, "COP", "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"),
    "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5",
  );
});

test("enlace de pago: lleva la llave pública, el valor, la referencia, la firma y el regreso", () => {
  const u = new URL(checkoutUrl({ publicKey: "pub_test_abc", integritySecret: "test_integrity_x" }, { reference: "lazo-123abc45", amountInCents: 7999000, redirectUrl: "https://lazo.ejemplo.com/business/x/pago?pago=1", email: "a@b.co" }));
  assert.equal(u.origin + u.pathname, "https://checkout.wompi.co/p/");
  assert.equal(u.searchParams.get("public-key"), "pub_test_abc");
  assert.equal(u.searchParams.get("currency"), "COP");
  assert.equal(u.searchParams.get("amount-in-cents"), "7999000");
  assert.equal(u.searchParams.get("reference"), "lazo-123abc45");
  assert.equal(u.searchParams.get("signature:integrity"), integritySignature("lazo-123abc45", 7999000, "COP", "test_integrity_x"));
  assert.equal(u.searchParams.get("redirect-url"), "https://lazo.ejemplo.com/business/x/pago?pago=1");
  assert.equal(u.searchParams.get("customer-data:email"), "a@b.co");
});

const evento = () => ({
  event: "transaction.updated",
  data: { transaction: { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 4490000, reference: "lazo-x", currency: "COP" } },
  environment: "prod",
  // SHA256 de «1234-1610641025-49201APPROVED44900001530291411prod_events_…» (la regla de la documentación;
  // el valor que muestra su ejemplo es ilustrativo y no corresponde a esa cadena).
  signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE" },
  timestamp: 1530291411,
});
const secreto = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";

test("aviso de Wompi: los datos del ejemplo de la documentación son válidos (también con el encabezado)", () => {
  assert.equal(verifyEvent(evento(), secreto), true);
  assert.equal(verifyEvent(evento(), secreto, "5a18ec5e8fdb7df463e9f94774cba8f583ba21bd04a09ceff2ea68a4bc0aefbe"), true);
});

test("aviso de Wompi: se rechaza si cambian el estado, el valor, el secreto o el encabezado", () => {
  const e1 = evento();
  e1.data.transaction.status = "DECLINED";
  assert.equal(verifyEvent(e1, secreto), false);
  const e2 = evento();
  e2.data.transaction.amount_in_cents = 1;
  assert.equal(verifyEvent(e2, secreto), false);
  assert.equal(verifyEvent(evento(), "prod_events_otro"), false);
  assert.equal(verifyEvent(evento(), secreto, "0".repeat(64)), false);
  assert.equal(verifyEvent({ ...evento(), signature: { properties: [], checksum: "x" } }, secreto), false);
  assert.equal(verifyEvent(null, secreto), false);
});

test("configuración: sin llave pública o secreto de integridad no hay pago en línea", () => {
  assert.equal(wompiConfig({}), null);
  assert.equal(wompiConfig({ WOMPI_PUBLIC_KEY: "pub_test_a" }), null);
  const c = wompiConfig({ WOMPI_PUBLIC_KEY: "pub_test_a", WOMPI_INTEGRITY_SECRET: "test_integrity_b" })!;
  assert.equal(c.eventsSecret, undefined);
  assert.equal(isSandbox(c), true);
  assert.equal(isSandbox({ publicKey: "pub_prod_a" }), false);
});
