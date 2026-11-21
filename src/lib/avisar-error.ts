/** Reporta un error a las alertas (Sentry) solo si están encendidas; si no, no carga la librería. */
export function avisarError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
