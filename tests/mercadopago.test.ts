// Mercado Pago: preferencia de pago, estados, valor y firma del aviso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { centavos, estadoOrden, idValido, mercadoPagoConfig, preferenceBody, verifySignature } from "../src/lib/pagos/mercadopago.ts";

test("preferencia: valor en pesos, referencia de la orden, regreso y aviso", () => {
  const b = preferenceBody({ reference: "lazo-abc12345", amount: 79990, title: "Lazo · 1 mes", returnUrl: "https://x.co/business/a/settings?pago=lazo-abc12345", notificationUrl: "https://x.co/api/pagos/mercadopago", email: "a@b.co" });
  assert.deepEqual(b.items, [{ id: "lazo-abc12345", title: "Lazo · 1 mes", quantity: 1, currency_id: "COP", unit_price: 79990 }]);
  assert.equal(b.external_reference, "lazo-abc12345");
  assert.equal(b.back_urls.success, "https://x.co/business/a/settings?pago=lazo-abc12345");
  assert.equal(b.auto_return, "approved");
  assert.equal(b.notification_url, "https://x.co/api/pagos/mercadopago");
  assert.deepEqual(b.payer, { email: "a@b.co" });
});

test("estados de Mercado Pago → estado de la orden", () => {
  assert.equal(estadoOrden("approved"), "APPROVED");
  assert.equal(estadoOrden("rejected"), "DECLINED");
  assert.equal(estadoOrden("refunded"), "VOIDED");
  assert.equal(estadoOrden("in_process"), "PENDING");
  assert.equal(estadoOrden("raro"), "ERROR");
});

test("valor en centavos, aunque llegue como texto", () => {
  assert.equal(centavos(79990), 7999000);
  assert.equal(centavos("79990.00"), 7999000);
  assert.equal(centavos(24.5), 2450);
});

test("solo se consultan ids de pago limpios", () => {
  assert.equal(idValido("123456789"), true);
  assert.equal(idValido("../v1/users"), false);
  assert.equal(idValido(""), false);
  assert.equal(idValido(null), false);
});

test("firma del aviso: HMAC-SHA256 de id, request-id y ts con la clave del webhook", () => {
  const secreto = "clave-secreta";
  const ts = "1742505638683";
  const v1 = createHmac("sha256", secreto).update(`id:123456;request-id:req-1;ts:${ts};`).digest("hex");
  assert.equal(verifySignature(secreto, { signature: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123456" }), true);
  assert.equal(verifySignature(secreto, { signature: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "999" }), false);
  assert.equal(verifySignature("otra", { signature: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123456" }), false);
  assert.equal(verifySignature(secreto, { signature: null, requestId: "req-1", dataId: "123456" }), false);
});

test("configuración: sin la llave privada no hay pago con Mercado Pago", () => {
  assert.equal(mercadoPagoConfig({}), null);
  assert.deepEqual(mercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: " APP_USR-x " }), { accessToken: "APP_USR-x", webhookSecret: undefined });
});
