import type { Instrumentation } from "next";

/**
 * Alertas de errores del servidor (ver src/lib/alertas.ts). La librería de Sentry es pesada y
 * alarga el arranque del servidor: solo se carga si NEXT_PUBLIC_SENTRY_DSN está puesta.
 */
const activo = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!activo) return;
  const [Sentry, { opcionesAlertas }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/alertas")]);
  Sentry.init(opcionesAlertas());
}

// Errores en páginas, acciones y rutas del servidor.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!activo) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
