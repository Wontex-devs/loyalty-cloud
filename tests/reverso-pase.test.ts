// Reverso del pase: WhatsApp, Instagram, horario, sitio web y cómo llegar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapsUrl, normalizePassInfo, normalizeInstagram, normalizeWebsite, normalizeWhatsapp, passInfoFrom } from "../src/lib/wallet/pass-info.ts";
import { passJson } from "../src/lib/wallet/apple.ts";
import { loyaltyClass } from "../src/lib/wallet/google.ts";
import { passFromCard } from "../src/lib/wallet/pass.ts";
import type { PublicCardData } from "../src/components/public/card-screen.tsx";

const card: PublicCardData = {
  token: "q7Lm2Xv9RkTz4pWb8Nc-_a",
  status: "active",
  stamps: 6,
  totalVisits: 15,
  customerName: "Sofía Martínez",
  memberSince: "2026-07-01T00:00:00Z",
  business: { name: "Beauty Club", slug: "beautyclub", branding: { logoText: "BC", primary: "#1A1416", primaryForeground: "#FFFFFF", accent: "#D8A7A7", cardBackground: "#EBCFCB", cardForeground: "#1A1416" } },
  program: { name: "Beauty Club", stampsRequired: 9, rewardName: "Manicura gratis", terms: "No acumulable con otras promociones." },
  rewards: [],
  recent: [],
  promotion: null,
};
const origin = "https://lazo.ejemplo.com";
const apple = { passTypeId: "pass.com.ejemplo.lazo", teamId: "ABCDE12345", authSecret: "s".repeat(40) };
const google = { issuerId: "3388000000012345678" };

test("limpia lo que escribe el comercio", () => {
  assert.equal(normalizeWhatsapp("300 123 4567"), "+573001234567");
  assert.equal(normalizeWhatsapp("+57 300-123-4567"), "+573001234567");
  assert.equal(normalizeWhatsapp("+1 (305) 555 0101"), "+13055550101");
  assert.equal(normalizeWhatsapp("123"), null);
  assert.equal(normalizeInstagram("@prueba.salon"), "prueba.salon");
  assert.equal(normalizeInstagram("https://www.instagram.com/prueba.salon/?hl=es"), "prueba.salon");
  assert.equal(normalizeInstagram("con espacio"), null);
  assert.equal(normalizeWebsite("www.tusalon.com"), "https://www.tusalon.com");
  assert.equal(normalizeWebsite("http://tusalon.com"), "https://tusalon.com");
  assert.equal(normalizeWebsite("javascript:alert(1)"), null);
  assert.equal(normalizeWebsite("sinpunto"), null);
  const r = normalizePassInfo({ whatsapp: " ", instagram: "@a", website: "", hours: "  Lun a sáb 9–7  " });
  assert.deepEqual(r, { ok: true, info: { instagram: "a", hours: "Lun a sáb 9–7" } });
  assert.equal(normalizePassInfo({ whatsapp: "12" }).ok, false);
  assert.equal(normalizePassInfo({ hours: "x".repeat(301) }).ok, false);
  assert.deepEqual(passInfoFrom({ whatsapp: "+573001234567", otra: 1, hours: 5 }), { whatsapp: "+573001234567", instagram: undefined, website: undefined, hours: undefined });
});

test("cómo llegar: la sede con ubicación o la dirección escrita", () => {
  assert.equal(mapsUrl([{ latitude: 10.99, longitude: -74.84 }], "Calle 118 #43-46"), "https://maps.google.com/?q=10.99,-74.84");
  assert.equal(mapsUrl([], "Calle 118 #43-46", "Barranquilla"), "https://www.google.com/maps/search/?api=1&query=Calle%20118%20%2343-46%2C%20Barranquilla");
  assert.equal(mapsUrl(undefined), undefined);
});

test("Apple: el reverso lleva los datos del comercio con enlaces y cómo funciona", () => {
  const info = { whatsapp: "+573001234567", instagram: "beauty.club", hours: "Lun a sáb 9–7", website: "https://beauty.example.com", address: "Calle 1 #2-3", mapsUrl: "https://maps.google.com/?q=1,2" };
  const j = passJson(apple, passFromCard(card, origin, [], info), origin) as unknown as { storeCard: { backFields: { key: string; label: string; value: string; attributedValue?: string }[] } };
  const f = Object.fromEntries(j.storeCard.backFields.map((x) => [x.key, x]));
  assert.equal(f.whatsapp.value, "+57 300 123 4567");
  assert.equal(f.whatsapp.attributedValue, '<a href="https://wa.me/573001234567">+57 300 123 4567</a>');
  assert.equal(f.instagram.attributedValue, '<a href="https://instagram.com/beauty.club">@beauty.club</a>');
  assert.equal(f.address.attributedValue, '<a href="https://maps.google.com/?q=1,2">Calle 1 #2-3</a>');
  assert.equal(f.hours.value, "Lun a sáb 9–7");
  assert.equal(f.website.value, "beauty.example.com");
  assert.equal(f.how.value, "Suma un sello en cada visita a Beauty Club. Al completar 9 sellos, recibes: Manicura gratis.\n\nNo acumulable con otras promociones.");
  // Sin datos del comercio: solo progreso, tarjeta y cómo funciona.
  const vacio = passJson(apple, passFromCard(card, origin), origin) as unknown as { storeCard: { backFields: { key: string }[] } };
  assert.deepEqual(vacio.storeCard.backFields.map((x) => x.key), ["progress", "card", "how"]);
});

test("Google: los enlaces van en la clase; sin consultarlos no se tocan", () => {
  const info = { whatsapp: "+573001234567", instagram: "beauty.club", hours: "Lun a sáb 9–7", mapsUrl: "https://maps.google.com/?q=1,2" };
  const c = loyaltyClass(google, passFromCard(card, origin, [], info)) as { linksModuleData: { uris: { id: string; uri: string }[] }; textModulesData: { header: string }[] };
  assert.deepEqual(c.linksModuleData.uris.map((u) => u.id), ["whatsapp", "instagram", "maps"]);
  assert.equal(c.linksModuleData.uris[0].uri, "https://wa.me/573001234567");
  assert.equal(c.textModulesData[0].header, "Horario");
  const borrado = loyaltyClass(google, passFromCard(card, origin, [], {})) as { linksModuleData: { uris: unknown[] } };
  assert.deepEqual(borrado.linksModuleData.uris, []);
  assert.equal("linksModuleData" in loyaltyClass(google, passFromCard(card, origin)), false);
});
