/** Nombre provisional de la plataforma (marca del SaaS, no del comercio). */
export const PLATFORM_NAME = "Loyalty Cloud";
/** Dominio que se muestra en enlaces públicos (sale de NEXT_PUBLIC_APP_URL). */
export const PUBLIC_HOST_LABEL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Origen para enlaces y QR. Con NEXT_PUBLIC_APP_URL coincide en servidor y navegador. */
export function publicOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
}
