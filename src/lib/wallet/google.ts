/**
 * Google Wallet (pases de fidelización). Sin dependencias: el JWT se firma con
 * node:crypto (RS256) y la API se llama con fetch.
 * Documentación: https://developers.google.com/wallet/retail/loyalty-cards
 */
import { createSign } from "node:crypto";
import { progressText, type WalletPass } from "./pass.ts";

export interface GoogleWalletConfig {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
}

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

// Los IDs solo admiten letras, números, ".", "_" y "-": el slug y el token ya cumplen.
export const classId = (cfg: Pick<GoogleWalletConfig, "issuerId">, slug: string) => `${cfg.issuerId}.biz-${slug}`;
export const objectId = (cfg: Pick<GoogleWalletConfig, "issuerId">, token: string) => `${cfg.issuerId}.card-${token}`;

const text = (value: string) => ({ defaultValue: { language: "es", value } });

/** Clase = diseño común del comercio (nombre, logo, color). */
export function loyaltyClass(cfg: Pick<GoogleWalletConfig, "issuerId">, p: Pick<WalletPass, "business" | "program">) {
  return {
    id: classId(cfg, p.business.slug),
    issuerName: p.business.name,
    programName: p.program.name,
    programLogo: { sourceUri: { uri: p.business.logoUrl }, contentDescription: text(p.business.name) },
    hexBackgroundColor: p.business.background,
    countryCode: "CO",
    reviewStatus: "UNDER_REVIEW",
  };
}

/** Objeto = la tarjeta de una clienta (sellos, QR, recompensas). */
export function loyaltyObject(cfg: Pick<GoogleWalletConfig, "issuerId">, p: WalletPass) {
  const modules = [{ id: "progress", header: "Tu progreso", body: progressText(p) }];
  if (p.promotion) modules.push({ id: "promo", header: `Hoy: ${p.promotion.name}`, body: `Tu visita de hoy suma ${1 + p.promotion.bonusStamps} sellos.` });
  return {
    id: objectId(cfg, p.token),
    classId: classId(cfg, p.business.slug),
    state: p.active ? "ACTIVE" : "INACTIVE",
    accountName: p.customerName,
    accountId: p.token.slice(0, 8),
    hexBackgroundColor: p.business.background,
    loyaltyPoints: { label: "Sellos", balance: { string: `${p.stamps}/${p.program.stampsRequired}` } },
    ...(p.rewardsAvailable.length ? { secondaryLoyaltyPoints: { label: "Premios", balance: { int: p.rewardsAvailable.length } } } : {}),
    textModulesData: modules,
    linksModuleData: { uris: [{ id: "card", uri: p.cardUrl, description: "Ver mi tarjeta" }] },
  };
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function signJwt(claims: Record<string, unknown>, privateKey: string) {
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${b64url(signature)}`;
}

/** Enlace "Guardar en Google Wallet": crea la clase y el objeto al guardarlo la clienta. */
export function saveUrl(cfg: GoogleWalletConfig, p: WalletPass, origin: string, now = Date.now()) {
  const jwt = signJwt(
    {
      iss: cfg.clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(now / 1000),
      origins: [origin],
      payload: { loyaltyClasses: [loyaltyClass(cfg, p)], loyaltyObjects: [loyaltyObject(cfg, p)] },
    },
    cfg.privateKey,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// ---------- API REST (actualizar pases ya guardados) ----------

let cached: { token: string; exp: number } | null = null;

async function accessToken(cfg: GoogleWalletConfig) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const assertion = signJwt({ iss: cfg.clientEmail, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, cfg.privateKey);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

/** PATCH de un recurso. 404 = la clienta aún no guardó el pase: no es un error. */
async function patch(cfg: GoogleWalletConfig, kind: "loyaltyClass" | "loyaltyObject", id: string, body: unknown) {
  const res = await fetch(`${API}/${kind}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await accessToken(cfg)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Google Wallet ${kind} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

/**
 * Mensaje con aviso en el celular. Google permite hasta 3 avisos al día por pase;
 * el mensaje queda visible en el pase durante 30 días. false = la clienta no guardó el pase.
 */
export function walletMessage(m: { id: string; title: string; body: string }, now = Date.now()) {
  return {
    message: {
      id: m.id,
      header: m.title,
      body: m.body,
      messageType: "TEXT_AND_NOTIFY",
      displayInterval: { end: { date: new Date(now + 30 * 86400000).toISOString() } },
    },
  };
}

export async function addMessage(cfg: GoogleWalletConfig, token: string, m: { id: string; title: string; body: string }) {
  const res = await fetch(`${API}/loyaltyObject/${encodeURIComponent(objectId(cfg, token))}/addMessage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(cfg)}`, "Content-Type": "application/json" },
    body: JSON.stringify(walletMessage(m)),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Google Wallet addMessage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

export const updateObject =(cfg: GoogleWalletConfig, p: WalletPass) => patch(cfg, "loyaltyObject", objectId(cfg, p.token), loyaltyObject(cfg, p));
export const updateClass = (cfg: GoogleWalletConfig, p: Pick<WalletPass, "business" | "program">) => patch(cfg, "loyaltyClass", classId(cfg, p.business.slug), loyaltyClass(cfg, p));
