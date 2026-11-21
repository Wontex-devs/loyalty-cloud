// Pruebas del pase de Apple Wallet: contenido, tokens del servicio web, ZIP y firma PKCS#7
// (la firma se verifica con OpenSSL, igual que la valida el iPhone).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authToken, buildPkpass, checkAuth, crc32, passJson, rgb, statusNotifies, statusText } from "../src/lib/wallet/apple.ts";
import { passFromCard } from "../src/lib/wallet/pass.ts";
import type { PublicCardData } from "../src/components/public/card-screen.tsx";

const origin = "https://lazo.ejemplo.com";
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
const base = { passTypeId: "pass.com.ejemplo.lazo", teamId: "ABCDE12345", authSecret: "s".repeat(40) };

/** Lee un ZIP sin compresión (lo que genera zip()). */
function unzip(buf: Buffer) {
  const files: Record<string, Buffer> = {};
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    assert.equal(buf.readUInt16LE(at + 8), 0, "sin compresión");
    const crc = buf.readUInt32LE(at + 14);
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const name = buf.subarray(at + 30, at + 30 + nameLen).toString("utf8");
    const data = buf.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    assert.equal(crc32(data), crc, `CRC de ${name}`);
    files[name] = data;
    at += 30 + nameLen + size;
  }
  return files;
}

test("colores en el formato rgb() que exige Apple", () => {
  assert.equal(rgb("#EBCFCB"), "rgb(235, 207, 203)");
  assert.equal(rgb("#fff"), "rgb(255, 255, 255)");
  assert.equal(rgb("rojo", "rgb(0, 0, 0)"), "rgb(0, 0, 0)");
});

test("el pase muestra sellos arriba, miembro, desde cuándo y progreso, sin código de barras", () => {
  const j = passJson(base, passFromCard(card, origin), origin);
  assert.equal(j.serialNumber, card.token);
  assert.equal(j.passTypeIdentifier, base.passTypeId);
  assert.equal(j.backgroundColor, "rgb(235, 207, 203)");
  // Arriba a la derecha va el conteo: es lo único visible con las tarjetas apiladas.
  assert.deepEqual(j.storeCard.headerFields.map((f) => [f.label, f.value]), [["SELLOS", "6 / 9"]]);
  // El premio y el hilo de sellos van dibujados en la franja.
  assert.equal(j.storeCard.primaryFields.length, 0);
  // El frente es solo la tarjeta: sin datos del miembro ni frase de progreso.
  assert.equal(j.storeCard.secondaryFields.length, 0);
  assert.equal(j.storeCard.auxiliaryFields.length, 0);
  // Fondo rosado claro: texto casi negro y etiquetas con el color del comercio.
  assert.equal(j.foregroundColor, "rgb(22, 19, 15)");
  assert.equal(j.labelColor, "rgb(26, 20, 22)");
  // El progreso va al reverso y es el aviso de cada visita.
  const progreso = j.storeCard.backFields.find((f) => f.key === "progress");
  assert.equal(progreso?.value, "Te faltan 3 visitas para: Manicura gratis.");
  assert.equal(progreso?.changeMessage, "%@");
  assert.equal("barcodes" in j, false);
  assert.equal("voided" in j, false);
  assert.equal(j.sharingProhibited, true);
  assert.ok(j.storeCard.backFields.some((f) => f.value === `${origin}/card/${card.token}`));
});

test("con premio listo lo destaca; tarjeta bloqueada queda anulada", () => {
  const conPremio = passFromCard({ ...card, stamps: 9, rewards: [{ name: "Manicura gratis" }] }, origin);
  const j = passJson(base, conPremio, origin);
  assert.match(String(j.storeCard.backFields.find((f) => f.key === "progress")?.value), /Tienes tu Manicura gratis/);
  assert.equal(statusText(conPremio), "Premio listo: Manicura gratis");
  assert.equal(passJson(base, passFromCard({ ...card, status: "blocked" }, origin), origin).voided, true);
});

test("solo con HTTPS lleva servicio de actualizaciones, con un token por pase", () => {
  const p = passFromCard(card, origin);
  const j = passJson(base, p, origin);
  assert.equal(j.webServiceURL, `${origin}/api/apple-wallet`);
  assert.ok((j.authenticationToken ?? "").length >= 16);
  assert.equal("webServiceURL" in passJson(base, p, "http://localhost:3000"), false);
  assert.notEqual(authToken(base, "otra-tarjeta"), j.authenticationToken);
});

test("el servicio web solo acepta el token de ese pase", () => {
  const t = authToken(base, card.token);
  assert.equal(checkAuth(base, card.token, `ApplePass ${t}`), true);
  assert.equal(checkAuth(base, "otra-tarjeta", `ApplePass ${t}`), false);
  assert.equal(checkAuth(base, card.token, `Bearer ${t}`), false);
  assert.equal(checkAuth(base, card.token, null), false);
  assert.equal(checkAuth({ authSecret: "otro".repeat(10) }, card.token, `ApplePass ${t}`), false);
});

test("el aviso del iPhone respeta los avisos que el comercio apagó", () => {
  const p = passFromCard(card, origin);
  const off = { stamp: false, near: true, reward: true };
  assert.equal(statusNotifies(p, null), true);
  assert.equal(statusNotifies(p, off), false);
  assert.equal("changeMessage" in passJson(base, p, origin, { settings: off }).storeCard.backFields.find((f) => f.key === "progress")!, false);
  assert.equal(statusNotifies(passFromCard({ ...card, stamps: 8 }, origin), off), true, "te falta 1");
  assert.equal(statusNotifies(passFromCard({ ...card, rewards: [{ name: "X" }] }, origin), { ...off, reward: false }), false);
});

test("el mensaje vigente del comercio va al reverso y avisa al cambiar", () => {
  const j = passJson(base, passFromCard(card, origin), origin, { message: { title: "Martes doble", body: "Hoy doble sello" } });
  const m = j.storeCard.backFields.find((f) => f.key === "message");
  assert.equal(m?.value, "Hoy doble sello");
  assert.equal(m?.changeMessage, "%@");
});

let openssl = true;
try {
  execFileSync("openssl", ["version"], { stdio: "ignore" });
} catch {
  openssl = false;
}

test("el .pkpass trae manifest con SHA-1 y una firma PKCS#7 válida", { skip: !openssl && "sin OpenSSL" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "pkpass-"));
  const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
  // CA de prueba en lugar de Apple WWDR y un certificado de pase firmado por ella.
  run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-subj", "/CN=Prueba WWDR");
  run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "pass.key", "-out", "pass.csr", "-subj", "/UID=pass.com.ejemplo.lazo/CN=Pase de prueba");
  run("x509", "-req", "-in", "pass.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "pass.pem", "-days", "2");

  const cfg = { ...base, certPem: readFileSync(join(dir, "pass.pem"), "utf8"), keyPem: readFileSync(join(dir, "pass.key"), "utf8"), wwdrPem: readFileSync(join(dir, "ca.pem"), "utf8") };
  const icon = Buffer.from("icono");
  const files = unzip(buildPkpass(cfg, passFromCard(card, origin), origin, { "icon.png": icon }));

  assert.deepEqual(Object.keys(files).sort(), ["icon.png", "manifest.json", "pass.json", "signature"]);
  const manifest = JSON.parse(files["manifest.json"].toString());
  assert.equal(manifest["icon.png"], createHash("sha1").update(icon).digest("hex"));
  assert.equal(manifest["pass.json"], createHash("sha1").update(files["pass.json"]).digest("hex"));
  assert.equal(JSON.parse(files["pass.json"].toString()).serialNumber, card.token);

  writeFileSync(join(dir, "manifest.json"), files["manifest.json"]);
  writeFileSync(join(dir, "signature"), files.signature);
  const out = run("smime", "-verify", "-binary", "-inform", "DER", "-in", "signature", "-content", "manifest.json", "-CAfile", "ca.pem", "-purpose", "any").toString();
  assert.equal(out, files["manifest.json"].toString());

  // Un manifest alterado ya no coincide con la firma.
  writeFileSync(join(dir, "manifest.json"), files["manifest.json"].toString().replace("}", ',"x":"1"}'));
  assert.throws(() => run("smime", "-verify", "-binary", "-inform", "DER", "-in", "signature", "-content", "manifest.json", "-CAfile", "ca.pem", "-purpose", "any"));
});

// ---------- Vencimiento del certificado ----------
import { certStatus, CERT_ALERT_DAYS } from "../src/lib/wallet/cert-expiry.ts";

test("la plataforma avisa 60 días antes de que venza el certificado de Apple", { skip: !openssl && "sin OpenSSL" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "cert-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "k.pem", "-out", "c.pem", "-days", "90", "-subj", "/CN=Pase"], { cwd: dir, stdio: "ignore" });
  const pem = readFileSync(join(dir, "c.pem"), "utf8");
  const hoy = new Date();
  assert.equal(CERT_ALERT_DAYS, 60);
  assert.equal(certStatus(pem, hoy)?.alert, null, "a 90 días no avisa");
  const en40 = new Date(hoy.getTime() + 50 * 86_400_000);
  const s = certStatus(pem, en40);
  assert.equal(s?.alert, "soon");
  assert.ok(s!.daysLeft >= 38 && s!.daysLeft <= 40, String(s?.daysLeft));
  assert.equal(certStatus(pem, new Date(hoy.getTime() + 91 * 86_400_000))?.alert, "expired");
  assert.equal(certStatus("no es un certificado"), null);
});

test("el pase lleva el código QR de la tarjeta, con el número legible debajo", () => {
  const j = passJson(base, passFromCard({ ...card, scanCode: "482910473365" }, origin), origin) as { barcodes?: { format: string; message: string; altText: string }[] };
  assert.deepEqual(j.barcodes, [{ format: "PKBarcodeFormatQR", message: "482910473365", messageEncoding: "iso-8859-1", altText: "4829 1047 3365" }]);
  // Sin número (o con uno raro) no se dibuja nada.
  assert.equal("barcodes" in passJson(base, passFromCard({ ...card, scanCode: "abc" }, origin), origin), false);
});

test("con código QR, «Cómo funciona» dice que se muestra en caja", () => {
  const j = passJson(base, passFromCard({ ...card, scanCode: "482910473365" }, origin), origin);
  const how = j.storeCard.backFields.find((f) => f.key === "how");
  assert.match(String(how?.value), /En caja, muestra el código QR de esta tarjeta para sumar tu sello\./);
});
