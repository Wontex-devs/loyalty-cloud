/**
 * Alertas de errores en el navegador (ver src/lib/alertas.ts). Solo se descarga la librería si
 * NEXT_PUBLIC_SENTRY_DSN está puesta: sin ella, el celular del cliente no carga nada extra.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void Promise.all([import("@sentry/nextjs"), import("@/lib/alertas")])
    .then(([Sentry, { opcionesAlertas }]) => Sentry.init(opcionesAlertas()))
    .catch(() => {});
}

export {};
