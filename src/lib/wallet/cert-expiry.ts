/**
 * Vencimiento del certificado de Apple Wallet. Si vence, los pases dejan de poder descargarse
 * y actualizarse sin avisar, así que la plataforma avisa con tiempo para renovarlo.
 */
import { X509Certificate } from "node:crypto";

/** Días de anticipación con que la plataforma empieza a avisar. */
export const CERT_ALERT_DAYS = 60;

export interface CertStatus {
  expiresAt: string;
  daysLeft: number;
  /** «expired»: ya venció · «soon»: vence en CERT_ALERT_DAYS días o menos · null: todo bien. */
  alert: "expired" | "soon" | null;
}

export function certStatus(pem: string, now = new Date()): CertStatus | null {
  try {
    const expires = new Date(new X509Certificate(pem).validTo);
    if (Number.isNaN(expires.getTime())) return null;
    const daysLeft = Math.floor((expires.getTime() - now.getTime()) / 86_400_000);
    return {
      expiresAt: expires.toISOString(),
      daysLeft,
      alert: expires.getTime() <= now.getTime() ? "expired" : daysLeft <= CERT_ALERT_DAYS ? "soon" : null,
    };
  } catch {
    return null;
  }
}
