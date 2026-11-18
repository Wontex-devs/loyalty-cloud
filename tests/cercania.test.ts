// Aviso de cercanía: lectura de coordenadas y ubicaciones en los pases de Apple y Google.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoordinates, placesFrom } from "../src/lib/wallet/geo.ts";
import { nearbyText, passJson } from "../src/lib/wallet/apple.ts";
import { loyaltyClass, loyaltyObject } from "../src/lib/wallet/google.ts";
import { passFromCard } from "../src/lib/wallet/pass.ts";
import { DEFAULT_WALLET_SETTINGS, nearbyMessage, walletSettings } from "../src/lib/wallet/messages.ts";
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
  assert.equal(json.locations?.[0].relevantText, "¡Hola Sofía! Estás cerca de Beauty Club. Te faltan 3 visitas para Manicura gratis");
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

test("Apple: usa el mensaje del comercio y el nombre aparte del cliente", () => {
  const p = passFromCard(card, origin, [sede]);
  const extras = { settings: { stamp: true, near: true, reward: true, nearbyText: "{nombre}, pasa por {comercio}: {progreso} 💅" }, firstName: "María José" };
  const json = passJson(apple, p, origin, extras) as { locations?: { relevantText: string }[] };
  assert.equal(json.locations?.[0].relevantText, "María José, pasa por Beauty Club: Te faltan 3 visitas para Manicura gratis 💅");
});

test("mensaje de cercanía: variables, premio listo y sin nombre", () => {
  const v = { nombre: "Ana", comercio: "Prueba Salon", progreso: "Premio listo: Manicura gratis" };
  assert.equal(nearbyMessage(DEFAULT_WALLET_SETTINGS.nearbyText, v), "¡Hola Ana! Estás cerca de Prueba Salon. Premio listo: Manicura gratis");
  assert.equal(nearbyMessage(DEFAULT_WALLET_SETTINGS.nearbyText, { ...v, nombre: "" }), "¡Hola! Estás cerca de Prueba Salon. Premio listo: Manicura gratis");
  assert.equal(nearbyMessage("Hola {nombre}, te esperamos", { ...v, nombre: " " }), "Hola, te esperamos");
  assert.equal(nearbyMessage("Sin variables", v), "Sin variables");
});

test("ajustes: el mensaje de cercanía se valida y si no sirve vuelve al sugerido", () => {
  assert.equal(walletSettings(null).nearbyText, DEFAULT_WALLET_SETTINGS.nearbyText);
  assert.equal(walletSettings({ nearbyText: "  ¡Ven {nombre}!  " }).nearbyText, "¡Ven {nombre}!");
  assert.equal(walletSettings({ nearbyText: "hey" }).nearbyText, DEFAULT_WALLET_SETTINGS.nearbyText);
  assert.equal(walletSettings({ nearbyText: "x".repeat(121) }).nearbyText, DEFAULT_WALLET_SETTINGS.nearbyText);
  assert.equal(walletSettings({ nearbyText: 42 }).nearbyText, DEFAULT_WALLET_SETTINGS.nearbyText);
});

// ---------- Estado de billetera e invitación ----------
import { savedTokens } from "../src/lib/wallet/google.ts";
import { cardMessage, whatsappUrl } from "../src/lib/wallet/invite.ts";

test("Google: solo cuentan las tarjetas que el cliente aún tiene guardadas", () => {
  const objs = [
    { id: `${google.issuerId}.card-AAA`, hasUsers: true },
    { id: `${google.issuerId}.card-BBB`, hasUsers: false },
    { id: `${google.issuerId}.card-CCC` },
    { id: `999.card-DDD`, hasUsers: true },
  ];
  assert.deepEqual([...savedTokens(google, objs)], ["AAA"]);
});

test("WhatsApp: invita a guardar la tarjeta solo si no está en la billetera", () => {
  const url = "https://lazo.ejemplo.com/card/x";
  assert.match(cardMessage("Ana", "Prueba Salon", url, false), /^Hola Ana, esta es tu tarjeta de Prueba Salon: .+\nÁbrela y toca «Agregar a Apple Wallet»/);
  assert.equal(cardMessage("Ana", "Prueba Salon", url, true), `Hola Ana, esta es tu tarjeta de Prueba Salon: ${url}`);
  assert.equal(cardMessage("", "Prueba Salon", url, true), `Hola, esta es tu tarjeta de Prueba Salon: ${url}`);
  assert.equal(whatsappUrl("+57 300 123 4567", "Hola Ana"), "https://wa.me/573001234567?text=Hola%20Ana");
});

// ---------- Paleta de la tarjeta e imagen de sellos ----------
import { cardPalette, contrast } from "../src/lib/domain/card-palette.ts";
import { stripUrl, stripVersion } from "../src/lib/wallet/pass.ts";

test("paleta: texto legible sobre el fondo y sellos con el color del comercio", () => {
  const azul = cardPalette({ cardBackground: "#1B3FD8", cardForeground: "#FFC928" });
  assert.equal(azul.text, "#FFFFFF");
  assert.equal(azul.accent, "#FFC928");
  assert.ok(contrast(azul.onAccent, azul.accent) >= 4.5);
  const rosa = cardPalette({ cardBackground: "#EBCFCB", cardForeground: "#1A1416" });
  assert.equal(rosa.text, "#16130F");
  // Color del comercio casi igual al fondo: los sellos usan el color del texto.
  assert.equal(cardPalette({ cardBackground: "#FFFFFF", cardForeground: "#F4F4F4" }).accent, "#16130F");
});

test("imagen de sellos: la URL cambia con cada sello y con el diseño", () => {
  const p = passFromCard(card, origin);
  assert.match(stripUrl(p), new RegExp(`^${origin}/card/${card.token}/sellos/6-9-[0-9a-z]+$`));
  assert.notEqual(stripVersion(p), stripVersion({ ...p, stamps: 7 }));
  assert.notEqual(stripVersion(p), stripVersion({ ...p, business: { ...p.business, background: "#000000" } }));
  const obj = loyaltyObject(google, p) as { heroImage?: { sourceUri: { uri: string } } };
  assert.equal(obj.heroImage?.sourceUri.uri, stripUrl(p));
});

test("estilos premium: noche y oro, cristal y negro mate", async () => {
  const { cardTheme, GOLD } = await import("../src/lib/domain/card-palette.ts");
  const b = { cardBackground: "#1B3FD8", cardForeground: "#FFC928" };
  assert.equal(cardTheme(b).style, "clasico");
  assert.equal(cardTheme({ ...b, cardStyle: "otro" }).style, "clasico");
  const noche = cardTheme({ ...b, cardStyle: "noche" });
  assert.equal(noche.accent, GOLD);
  assert.equal(noche.text, "#FFFFFF");
  assert.ok(contrast(noche.bg, "#FFFFFF") >= 7, "el fondo profundo deja leer el texto blanco");
  const negro = cardTheme({ ...b, cardStyle: "negro" });
  assert.equal(negro.bg, "#111114");
  assert.equal(negro.accent, "#FFC928");
  // Color del comercio oscuro sobre negro: los sellos pasan a dorado.
  assert.equal(cardTheme({ cardBackground: "#EBCFCB", cardForeground: "#1A1416", cardStyle: "negro" }).accent, GOLD);
  const cristal = cardTheme({ ...b, cardStyle: "cristal" });
  assert.equal(cristal.photo, "full");
  assert.equal(cristal.glass, true);
});

test("pases: el estilo cambia los colores y la imagen de sellos", () => {
  const premium = { ...card, business: { ...card.business, branding: { ...card.business.branding, cardStyle: "noche" as const } } };
  const p = passFromCard(premium, origin);
  const j = passJson(apple, p, origin) as { backgroundColor: string; foregroundColor: string; labelColor: string };
  assert.equal(j.foregroundColor, "rgb(255, 255, 255)");
  assert.equal(j.labelColor, "rgb(232, 200, 115)");
  assert.notEqual(j.backgroundColor, "rgb(235, 207, 203)");
  assert.notEqual(stripVersion(p), stripVersion(passFromCard(card, origin)));
  assert.equal((loyaltyClass(google, p) as { hexBackgroundColor: string }).hexBackgroundColor, cardTheme_bg(p));
});
const cardTheme_bg = (p: ReturnType<typeof passFromCard>) => passTheme(p).bg;
import { passTheme } from "../src/lib/wallet/pass.ts";
