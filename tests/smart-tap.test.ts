// Pruebas de Smart Tap: qué lleva el pase de Google y qué entiende la pantalla «Lector NFC».
import { test } from "node:test";
import assert from "node:assert/strict";
import { loyaltyClass, loyaltyObject, objectId } from "../src/lib/wallet/google.ts";
import { passFromCard } from "../src/lib/wallet/pass.ts";
import { parseToken } from "../src/lib/wallet/smart-tap.ts";
import type { PublicCardData } from "../src/components/public/card-screen.tsx";

const origin = "https://lazo.ejemplo.com";
const token = "q7Lm2Xv9RkTz4pWb8Nc-_a";
const card: PublicCardData = {
  token,
  status: "active",
  stamps: 2,
  totalVisits: 2,
  customerName: "Ana",
  memberSince: "2026-07-01T00:00:00Z",
  business: { name: "Café", slug: "cafe", branding: { logoText: "C", primary: "#111111", primaryForeground: "#FFFFFF", accent: "#CCCCCC", cardBackground: "#EEEEEE", cardForeground: "#111111" } },
  program: { name: "Club", stampsRequired: 8, rewardName: "Café gratis", terms: "" },
  rewards: [],
  recent: [],
  promotion: null,
};
const base = { issuerId: "3388000000012345678" };
const p = passFromCard(card, origin);

test("sin Smart Tap el pase queda igual que antes", () => {
  const c = loyaltyClass(base, p);
  const o = loyaltyObject(base, p);
  assert.equal("enableSmartTap" in c, false);
  assert.equal("redemptionIssuers" in c, false);
  assert.equal("smartTapRedemptionValue" in o, false);
});

test("con Smart Tap la clase lo habilita para nuestro emisor y el pase envía el token", () => {
  const cfg = { ...base, smartTap: true };
  const c = loyaltyClass(cfg, p) as { enableSmartTap?: boolean; redemptionIssuers?: string[] };
  assert.equal(c.enableSmartTap, true);
  assert.deepEqual(c.redemptionIssuers, [base.issuerId]);
  assert.equal((loyaltyObject(cfg, p) as { smartTapRedemptionValue?: string }).smartTapRedemptionValue, token);
});

test("el lector entiende el token, el ID del pase y el enlace de la tarjeta", () => {
  assert.equal(parseToken(token), token);
  assert.equal(parseToken(`  ${token}\r`), token);
  // Pases guardados antes de encender Smart Tap: Google envía el ID del objeto.
  assert.equal(parseToken(objectId(base, token)), token);
  // Un lector de QR en modo teclado escribe la URL de la tarjeta.
  assert.equal(parseToken(`${origin}/card/${token}`), token);
  assert.equal(parseToken(`${origin}/card/${token}?new=1`), token);
});

test("el lector ignora lecturas que no son tarjetas", () => {
  assert.equal(parseToken(""), null);
  assert.equal(parseToken("hola"), null);
  assert.equal(parseToken("https://otro-sitio.com/promo"), null);
  assert.equal(parseToken("token con espacios dentro de 30 caracteres"), null);
});
