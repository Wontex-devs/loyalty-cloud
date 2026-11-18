/**
 * Apple Wallet (pases .pkpass). Sin dependencias: la firma PKCS#7 (CMS) se arma
 * a mano en DER y se firma con node:crypto; el .pkpass es un ZIP sin compresión.
 * Documentación: https://developer.apple.com/documentation/walletpasses
 */
import { createHash, createHmac, createSign, timingSafeEqual, X509Certificate } from "node:crypto";
import { passTheme, progressText, type WalletPass } from "./pass.ts";
import { appleInfoFields } from "./pass-info.ts";
import { DEFAULT_WALLET_SETTINGS, nearbyMessage } from "./messages.ts";
import type { WalletSettings } from "../domain/types.ts";

export interface AppleWalletConfig {
  /** Pass Type ID registrado en Apple Developer, p. ej. pass.com.wontex.lazo */
  passTypeId: string;
  /** Team ID de 10 caracteres de la cuenta de Apple Developer. */
  teamId: string;
  /** Certificado del Pass Type ID (PEM). */
  certPem: string;
  /** Clave privada del certificado (PEM). */
  keyPem: string;
  keyPassphrase?: string;
  /** Certificado intermedio de Apple (WWDR G4, PEM). */
  wwdrPem: string;
  /** Secreto para los tokens con que el iPhone se identifica ante nuestro servicio web. */
  authSecret: string;
}

/** Mensaje vigente del comercio (campaña, cumpleaños…), visible al reverso del pase. */
export interface PassMessage {
  title: string;
  body: string;
}

export interface PassExtras {
  message?: PassMessage | null;
  /** Avisos que el comercio dejó encendidos; sin ellos, todos. */
  settings?: (Pick<WalletSettings, "stamp" | "near" | "reward"> & Partial<Pick<WalletSettings, "nearbyText">>) | null;
  /** Nombre para saludar en el mensaje de cercanía (sin apellido). */
  firstName?: string | null;
}

// ---------- Contenido del pase ----------

/** "#EBCFCB" → "rgb(235, 207, 203)", el formato que exige Apple. */
export function rgb(hex: string, fallback = "rgb(255, 255, 255)") {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return fallback;
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Token con que el iPhone pide actualizaciones de este pase (mínimo 16 caracteres para Apple). */
export const authToken = (cfg: Pick<AppleWalletConfig, "authSecret">, serial: string) =>
  createHmac("sha256", cfg.authSecret).update(`apple-pass:${serial}`).digest("base64url");

/** Compara el encabezado "Authorization: ApplePass <token>" sin filtrar tiempos. */
export function checkAuth(cfg: Pick<AppleWalletConfig, "authSecret">, serial: string, header: string | null) {
  const got = Buffer.from(header?.match(/^ApplePass\s+(\S+)$/)?.[1] ?? "");
  const want = Buffer.from(authToken(cfg, serial));
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Texto corto de progreso: es el que aparece en la notificación al sumar un sello. */
export function statusText(p: WalletPass) {
  if (p.rewardsAvailable.length) {
    const r = p.rewardsAvailable[0];
    return r.birthday ? `Regalo de cumpleaños listo: ${r.name}` : `Premio listo: ${r.name}`;
  }
  const left = Math.max(p.program.stampsRequired - p.stamps, 0);
  return `${left === 1 ? "Te falta 1 visita" : `Te faltan ${left} visitas`} para ${p.program.rewardName}`;
}

/** ¿Avisa el iPhone cuando cambia el progreso? Mismas reglas que los avisos de Google tras una visita. */
export function statusNotifies(p: WalletPass, settings?: PassExtras["settings"]) {
  if (!settings) return true;
  if (p.rewardsAvailable.length) return settings.reward;
  const left = Math.max(p.program.stampsRequired - p.stamps, 0);
  return (left === 1 && settings.near) || settings.stamp;
}

/** Texto que el iPhone muestra en la pantalla bloqueada al estar cerca de una sede (el que escribió el comercio). */
export function nearbyText(p: WalletPass, extras: Pick<PassExtras, "settings" | "firstName"> = {}) {
  const nombre = extras.firstName?.trim() || p.customerName.trim().split(/\s+/)[0] || "";
  return nearbyMessage(extras.settings?.nearbyText || DEFAULT_WALLET_SETTINGS.nearbyText, { nombre, comercio: p.business.name, progreso: statusText(p) });
}

/** Reglas del programa en una frase, más sus condiciones si el comercio las escribió. */
export function howItWorks(p: Pick<WalletPass, "program" | "business">) {
  const n = p.program.stampsRequired;
  const base = `Suma un sello en cada visita a ${p.business.name}. Al completar ${n} ${n === 1 ? "sello" : "sellos"}, recibes: ${p.program.rewardName}.`;
  const terms = p.program.terms?.trim();
  return terms ? `${base}\n\n${terms}` : base;
}

export function passJson(cfg: Pick<AppleWalletConfig, "passTypeId" | "teamId" | "authSecret">, p: WalletPass, origin: string, extras: PassExtras = {}) {
  const { message } = extras;
  // Mismos colores que la tarjeta web: texto legible y etiquetas con el color del comercio.
  const c = passTheme(p);
  const label = c.passLabel;
  const back: Record<string, unknown>[] = [{ key: "progress", label: "Tu progreso", value: progressText(p) }];
  if (p.promotion) back.push({ key: "promo", label: `Hoy: ${p.promotion.name}`, value: `Tu visita de hoy suma ${1 + p.promotion.bonusStamps} sellos.` });
  if (message) back.push({ key: "message", label: message.title, value: message.body, changeMessage: "%@" });
  // Datos del comercio: WhatsApp, Instagram, cómo llegar, horario y sitio web (se pueden tocar).
  back.push(...appleInfoFields(p.info));
  back.push({
    key: "card",
    label: "Tu tarjeta",
    value: p.cardUrl,
    attributedValue: `<a href="${p.cardUrl}">Ver mi tarjeta</a>`,
  });
  back.push({ key: "how", label: "Cómo funciona", value: howItWorks(p) });

  // Apple solo acepta un servicio web con HTTPS; en local el pase funciona sin actualizaciones.
  const updates = origin.startsWith("https://")
    ? { webServiceURL: `${origin}/api/apple-wallet`, authenticationToken: authToken(cfg, p.token) }
    : {};

  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: p.token,
    organizationName: p.business.name,
    description: `Tarjeta de fidelización de ${p.business.name}`,
    // Sin logoText: el nombre va dentro del logo, con la letra de la marca.
    backgroundColor: rgb(c.bg),
    foregroundColor: rgb(c.text, "rgb(0, 0, 0)"),
    labelColor: rgb(label, "rgb(0, 0, 0)"),
    sharingProhibited: true,
    ...(p.active ? {} : { voided: true }),
    ...updates,
    // Hasta 10 sedes: cerca de una, la tarjeta aparece en la pantalla bloqueada.
    ...(p.places?.length && p.active
      ? { locations: p.places.map((l) => ({ latitude: l.latitude, longitude: l.longitude, relevantText: nearbyText(p, extras) })) }
      : {}),
    storeCard: {
      // La franja (strip.png) ya muestra las visitas, los sellos y la recompensa: arriba no va nada más.
      headerFields: [],
      primaryFields: [],
      secondaryFields: [{ key: "customer", label: "CLIENTE", value: p.customerName }],
      // El único campo con changeMessage del frente: una notificación por visita, no varias.
      auxiliaryFields: [
        { key: "status", label: p.program.name.toUpperCase(), value: statusText(p), ...(statusNotifies(p, extras.settings) ? { changeMessage: "%@" } : {}) },
      ],
      backFields: back,
    },
  };
}

// ---------- DER mínimo para la firma ----------

function len(n: number) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let x = n; x > 0; x >>= 8) bytes.unshift(x & 255);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag: number, ...parts: Buffer[]) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), len(body.length), body]);
};
const seq = (...p: Buffer[]) => tlv(0x30, ...p);
/** SET OF en DER: los elementos van ordenados por su codificación. */
const set = (...p: Buffer[]) => tlv(0x31, ...[...p].sort(Buffer.compare));
const int = (n: number) => tlv(0x02, Buffer.from([n]));
const octets = (b: Buffer) => tlv(0x04, b);
const NULL = Buffer.from([0x05, 0x00]);

function oid(dotted: string) {
  const [a, b, ...rest] = dotted.split(".").map(Number);
  const out = [40 * a + b];
  for (const n of rest) {
    const chunk = [n & 0x7f];
    for (let x = n >>> 7; x > 0; x >>>= 7) chunk.unshift(0x80 | (x & 0x7f));
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
}

function utcTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(s, "ascii"));
}

/** Lee un TLV y devuelve [elemento completo, contenido, siguiente posición]. */
function readTlv(buf: Buffer, at: number): [Buffer, Buffer, number] {
  let i = at + 1;
  let n = buf[i++];
  if (n & 0x80) {
    const k = n & 0x7f;
    n = 0;
    for (let j = 0; j < k; j++) n = n * 256 + buf[i++];
  }
  return [buf.subarray(at, i + n), buf.subarray(i, i + n), i + n];
}

/** Emisor y número de serie tal cual vienen en el certificado (identifican al firmante). */
function issuerAndSerial(certDer: Buffer) {
  const [, cert] = readTlv(certDer, 0);
  const [, tbs] = readTlv(cert, 0);
  let at = 0;
  if (tbs[0] === 0xa0) at = readTlv(tbs, 0)[2]; // versión explícita
  const [serial, , afterSerial] = readTlv(tbs, at);
  const [, , afterAlg] = readTlv(tbs, afterSerial);
  const [issuer] = readTlv(tbs, afterAlg);
  return seq(issuer, serial);
}

const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  sha256: "2.16.840.1.101.3.4.2.1",
  rsa: "1.2.840.113549.1.1.1",
};

/** Firma PKCS#7 separada del manifest.json, con el certificado del pase y el de Apple (WWDR). */
export function signManifest(cfg: Pick<AppleWalletConfig, "certPem" | "keyPem" | "keyPassphrase" | "wwdrPem">, manifest: Buffer, now = new Date()) {
  const cert = new X509Certificate(cfg.certPem).raw;
  const wwdr = new X509Certificate(cfg.wwdrPem).raw;
  const sha256 = seq(oid(OID.sha256), NULL);

  const attrs = [
    seq(oid(OID.contentType), set(oid(OID.data))),
    seq(oid(OID.signingTime), set(utcTime(now))),
    seq(oid(OID.messageDigest), set(octets(createHash("sha256").update(manifest).digest()))),
  ];
  // Se firma el SET de atributos; dentro de SignerInfo va con la etiqueta [0] implícita.
  const signedAttrs = set(...attrs);
  const signature = createSign("RSA-SHA256")
    .update(signedAttrs)
    .sign({ key: cfg.keyPem, passphrase: cfg.keyPassphrase });

  const signerInfo = seq(
    int(1),
    issuerAndSerial(cert),
    sha256,
    Buffer.concat([Buffer.from([0xa0]), signedAttrs.subarray(1)]),
    seq(oid(OID.rsa), NULL),
    octets(signature),
  );
  const signedData = seq(
    int(1),
    set(sha256),
    seq(oid(OID.data)),
    tlv(0xa0, cert, wwdr),
    set(signerInfo),
  );
  return seq(oid(OID.signedData), tlv(0xa0, signedData));
}

// ---------- ZIP sin compresión ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files: Record<string, Buffer>) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const fname = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(10, 4); // versión necesaria
    head.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    head.writeUInt16LE(0, 8); // sin compresión
    head.writeUInt16LE(0, 10);
    head.writeUInt16LE(0x21, 12); // 1980-01-01
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(fname.length, 26);
    head.writeUInt16LE(0, 28);
    locals.push(head, fname, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(10, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(fname.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, fname);
    offset += 30 + fname.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---------- Paquete ----------

/**
 * Arma el .pkpass: pass.json + imágenes, manifest.json (SHA-1 de cada archivo,
 * como pide Apple) y la firma del manifest.
 */
export function buildPkpass(cfg: AppleWalletConfig, p: WalletPass, origin: string, images: Record<string, Buffer>, extras: PassExtras = {}, now = new Date()) {
  const files: Record<string, Buffer> = { "pass.json": Buffer.from(JSON.stringify(passJson(cfg, p, origin, extras))), ...images };
  const manifest = Buffer.from(
    JSON.stringify(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, createHash("sha1").update(data).digest("hex")]))),
  );
  return zip({ ...files, "manifest.json": manifest, signature: signManifest(cfg, manifest, now) });
}
