// Aviso de cercanía: lectura de coordenadas y ubicaciones en los pases de Apple y Google.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoordinates, placesFrom } from "../src/lib/wallet/geo.ts";
import { nearbyText, passJson } from "../src/lib/wallet/apple.ts";
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
  program: { name: "Beauty Club", stampsRequired: 9, rewardName: "Manicura gratis", terms: "" },
  rewards: [],
  recent: [],
  promotion: null,
};
const origin = "https://lazo.ejemplo.com";
const apple = { passTypeId: "pass.com.ejemplo.lazo", teamId: "ABCDE12345", authSecret: "s".repeat(40) };
const google = { issuerId: "3388000000012345678" };
const sede = { latitude: 4.698712, longitude: -74.041234 };

test("reconoce coordenadas escritas a mano", () => {
  assert.deepEqual(parseCoordinates("4.698712, -74.041234"), sede);
  assert.deepEqual(parseCoordinates("  4.698712,-74.041234 "), sede);
  assert.deepEqual(parseCoordinates("4.698712 -74.041234"), sede);
  assert.deepEqual(parseCoordinates("4.6987123456, -74.0412341"), sede); // redondea a 6 decimales
});

test("reconoce enlaces completos de Google Maps (prefiere el punto exacto del lugar)", () => {
  assert.deepEqual(parseCoordinates("https://www.google.com/maps/place/Salon/@4.7,-74.05,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d4.698712!4d-74.041234"), sede);
  assert.deepEqual(parseCoordinates("https://www.google.com/maps/@4.698712,-74.041234,18z"), sede);
  assert.deepEqual(parseCoordinates("https://maps.google.com/?q=4.698712,-74.041234"), sede);
  assert.deepEqual(parseCoordinates("https://www.google.com/maps/search/?api=1&query=4.698712%2C-74.041234"), sede);
});

test("rechaza lo que no son coordenadas válidas", () => {
  assert.equal(parseCoordinates("https://maps.app.goo.gl/AbCdEf123"), null);
  assert.equal(parseCoordinates("Calle 118 # 43-46"), null);
  assert.equal(parseCoordinates("95, -74"), null);
  assert.equal(parseCoordinates("4.6, -190"), null);
  assert.equal(parseCoordinates("0, 0"), null);
  assert.equal(parseCoordinates(""), null);
});

test("solo sedes activas con ubicación, sin repetir y como máximo 10", () => {
  const rows = [
    { ...sede, active: true },
    { ...sede, active: true },
    { latitude: 6.2, longitude: -75.5, active: false },
    { latitude: null, longitude: null, active: true },
    ...Array.from({ length: 12 }, (_, i) => ({ latitude: 3 + i / 100, longitude: -76, active: true })),
  ];
  const places = placesFrom(rows);
  assert.equal(places.length, 10);
  assert.deepEqual(places[0], sede);
  assert.ok(!places.some((p) => p.latitude === 6.2));
});

test("Apple: el pase lleva las sedes y el texto de cercanía con el progreso", () => {
  const p = passFromCard(card, origin, [sede]);
  const json = passJson(apple, p, origin) as { locations?: { latitude: number; longitude: number; relevantText: string }[] };
  assert.equal(json.locations?.length, 1);
  assert.equal(json.locations?.[0].latitude, sede.latitude);
  assert.equal(json.locations?.[0].relevantText, "Estás cerca de Beauty Club. Te faltan 3 visitas para Manicura gratis");
  assert.equal(nearbyText(p), json.locations?.[0].relevantText);
});

test("Apple: sin sedes con ubicación, o con la tarjeta bloqueada, no hay aviso de cercanía", () => {
  assert.equal("locations" in passJson(apple, passFromCard(card, origin, []), origin), false);
  assert.equal("locations" in passJson(apple, passFromCard(card, origin), origin), false);
  assert.equal("locations" in passJson(apple, passFromCard({ ...card, status: "blocked" }, origin, [sede]), origin), false);
});

test("Google: el programa lleva las sedes; lista vacía las borra y sin consultarlas no se tocan", () => {
  const withPlaces = loyaltyClass(google, passFromCard(card, origin, [sede])) as { merchantLocations?: unknown[] };
  assert.deepEqual(withPlaces.merchantLocations, [{ latitude: sede.latitude, longitude: sede.longitude }]);
  const empty = loyaltyClass(google, passFromCard(card, origin, [])) as { merchantLocations?: unknown[] };
  assert.deepEqual(empty.merchantLocations, []);
  assert.equal("merchantLocations" in loyaltyClass(google, passFromCard(card, origin)), false);
});
