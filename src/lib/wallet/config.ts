import "server-only";
import type { GoogleWalletConfig } from "./google";
import type { AppleWalletConfig } from "./apple";
import { APPLE_WWDR_G4 } from "./apple-wwdr";

/**
 * Credenciales de Google Wallet (solo servidor). Sin ellas el botón no aparece.
 * - GOOGLE_WALLET_ISSUER_ID: ID de emisor de Google Pay & Wallet Console.
 * - GOOGLE_WALLET_SERVICE_ACCOUNT: JSON de la cuenta de servicio (tal cual o en base64).
 * - GOOGLE_WALLET_SMART_TAP=1: activa el toque con lector NFC (después de subir la clave en la consola).
 */
export function googleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT?.trim();
  if (!issuerId || !raw) return null;
  try {
    const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    const smartTap = process.env.GOOGLE_WALLET_SMART_TAP?.trim() === "1";
    return { issuerId, clientEmail: json.client_email, privateKey: json.private_key, smartTap };
  } catch {
    return null;
  }
}

export const isGoogleWalletEnabled = () => googleWalletConfig() !== null;

/**
 * Credenciales de Apple Wallet (solo servidor). Sin ellas el botón de iPhone no aparece.
 * - APPLE_WALLET_PASS_TYPE_ID y APPLE_WALLET_TEAM_ID: de Apple Developer.
 * - APPLE_WALLET_CERT y APPLE_WALLET_KEY: certificado del Pass Type ID y su clave (PEM tal cual o en base64).
 * - APPLE_WALLET_KEY_PASSPHRASE: solo si la clave tiene contraseña.
 * - APPLE_WALLET_AUTH_SECRET: secreto aleatorio (32+ caracteres) para el servicio de actualizaciones.
 */
export function appleWalletConfig(): AppleWalletConfig | null {
  const passTypeId = process.env.APPLE_WALLET_PASS_TYPE_ID?.trim();
  const teamId = process.env.APPLE_WALLET_TEAM_ID?.trim();
  const certPem = pem(process.env.APPLE_WALLET_CERT);
  const keyPem = pem(process.env.APPLE_WALLET_KEY);
  const authSecret = process.env.APPLE_WALLET_AUTH_SECRET?.trim();
  if (!passTypeId || !teamId || !certPem || !keyPem || !authSecret || authSecret.length < 32) return null;
  return { passTypeId, teamId, certPem, keyPem, keyPassphrase: process.env.APPLE_WALLET_KEY_PASSPHRASE || undefined, wwdrPem: APPLE_WWDR_G4, authSecret };
}

/** Acepta el PEM tal cual, con "\n" escapados o en base64 (más cómodo en Vercel). */
function pem(raw: string | undefined) {
  const v = raw?.trim();
  if (!v) return null;
  const text = v.startsWith("-----") ? v.replaceAll("\\n", "\n") : Buffer.from(v, "base64").toString("utf8");
  return text.includes("-----BEGIN") ? text : null;
}

export const isAppleWalletEnabled = () => appleWalletConfig() !== null;
