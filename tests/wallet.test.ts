// Pruebas del pase de Google Wallet: contenido, IDs y firma del JWT (sin llamar a Google).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { classId, loyaltyObject, objectId, saveUrl } from "../src/lib/wallet/google.ts";
import { passFromCard, progressText } from "../src/lib/wallet/pass.ts";
import type { PublicCardData } from "../src/components/public/card-screen.tsx";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cfg = { issuerId: "3388000000012345678", clientEmail: "wallet@demo.iam.gserviceaccount.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
const origin = "https://ejemplo.vercel.app";

const card: PublicCardData = {
  token: "q7Lm2Xv9RkTz4pWb8Nc-_a",
  status: "active",
  stamps: 6,
  totalVisits: 15,
  customerName: "Sofía Martínez",
  memberSince: "2026-07-01T00:00:00Z",
  business: { name: "Beauty Club", slug: "beautyclub", branding: { logoText: "BC", primary: "#1A1416", primaryForeground: "#FFFFFF", accent: "#D8A7A7", cardBackground: "#EBCFCB", cardForeground: "#1A1416" } },
  program: { name: "Beauty Club", stampsRequired: 9, rewardName: "Manicura gratis", terms: "" },
  rewards: [],
  recent: [],
  promotion: null,
};

test("IDs válidos para Google (emisor.prefijo-…)", () => {
  assert.equal(classId(cfg, "beautyclub"), "3388000000012345678.biz-beautyclub");
  assert.match(objectId(cfg, card.token), /^3388000000012345678\.card-[A-Za-z0-9_-]+$/);
});

test("el pase muestra sellos, QR con el enlace y progreso", () => {
  const p = passFromCard(card, origin);
  const o = loyaltyObject(cfg, p);
  assert.equal(o.loyaltyPoints.balance.string, "6/9");
  assert.equal(o.barcode.value, `${origin}/card/${card.token}`);
  assert.equal(o.state, "ACTIVE");
  assert.match(o.textModulesData[0].body, /faltan 3 visitas para: Manicura gratis/);
  assert.equal("secondaryLoyaltyPoints" in o, false);
});

test("recompensa disponible, promoción y tarjeta bloqueada", () => {
  const p = passFromCard({ ...card, status: "blocked", rewards: [{ name: "Esmalte", kind: "birthday" }], promotion: { name: "Doble sello", bonusStamps: 1 } }, origin);
  const o = loyaltyObject(cfg, p);
  assert.equal(o.state, "INACTIVE");
  assert.match(progressText(p), /regalo de cumpleaños: Esmalte/);
  assert.equal(o.textModulesData[1].header, "Hoy: Doble sello");
  assert.equal((o as { secondaryLoyaltyPoints?: { balance: { int: number } } }).secondaryLoyaltyPoints?.balance.int, 1);
});

test("enlace de guardado: JWT RS256 firmado con la clase y el objeto", () => {
  const url = saveUrl(cfg, passFromCard(card, origin), origin, 1_800_000_000_000);
  assert.ok(url.startsWith("https://pay.google.com/gp/v/save/"));
  const jwt = url.split("/").pop()!;
  const [h, c, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.aud, "google");
  assert.equal(claims.typ, "savetowallet");
  assert.equal(claims.iss, cfg.clientEmail);
  assert.deepEqual(claims.origins, [origin]);
  assert.equal(claims.payload.loyaltyClasses[0].id, "3388000000012345678.biz-beautyclub");
  assert.equal(claims.payload.loyaltyClasses[0].programLogo.sourceUri.uri, `${origin}/join/beautyclub/icon/660`);
  assert.equal(claims.payload.loyaltyObjects[0].classId, claims.payload.loyaltyClasses[0].id);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url")));
  assert.ok(!JSON.stringify(claims).includes("+57"), "el pase no debe llevar el teléfono");
});
