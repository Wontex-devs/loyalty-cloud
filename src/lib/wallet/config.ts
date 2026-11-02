import "server-only";
import type { GoogleWalletConfig } from "./google";

/**
 * Credenciales de Google Wallet (solo servidor). Sin ellas el botón no aparece.
 * - GOOGLE_WALLET_ISSUER_ID: ID de emisor de Google Pay & Wallet Console.
 * - GOOGLE_WALLET_SERVICE_ACCOUNT: JSON de la cuenta de servicio (tal cual o en base64).
 */
export function googleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT?.trim();
  if (!issuerId || !raw) return null;
  try {
    const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    return { issuerId, clientEmail: json.client_email, privateKey: json.private_key };
  } catch {
    return null;
  }
}

export const isGoogleWalletEnabled = () => googleWalletConfig() !== null;
