/**
 * Alertas de errores (Sentry). Solo se encienden en producción y si existe la variable
 * NEXT_PUBLIC_SENTRY_DSN (se pone en Vercel). Sin ella, no se envía nada.
 *
 * Datos personales (Ley 1581): no se envían IP, cookies, encabezados, cuerpos de formularios ni
 * parámetros de las direcciones. El enlace de cada tarjeta y el secreto de la etiqueta NFC se tapan.
 */

type Evento = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown };
  user?: unknown;
  breadcrumbs?: { data?: Record<string, unknown>; message?: string }[];
  transaction?: string;
  message?: string;
};

/** Quita lo privado de una dirección: parámetros (?k=secreto) y tokens de tarjeta. */
export function taparDireccion(texto: string): string {
  return texto
    .replace(/(\/(?:card|c)\/)[^/?#\s"']+/g, "$1[token]")
    .replace(/\?[^#\s"']*/g, "")
    .replace(/#[^\s"']*/g, "");
}

export function limpiarEvento<T extends Evento>(evento: T): T {
  if (evento.request) {
    if (evento.request.url) evento.request.url = taparDireccion(evento.request.url);
    delete evento.request.query_string;
    delete evento.request.cookies;
    delete evento.request.headers;
    delete evento.request.data;
  }
  delete evento.user;
  if (evento.transaction) evento.transaction = taparDireccion(evento.transaction);
  if (evento.message) evento.message = taparDireccion(evento.message);
  for (const b of evento.breadcrumbs ?? []) {
    if (b.message) b.message = taparDireccion(b.message);
    if (b.data) {
      for (const k of ["url", "from", "to"]) if (typeof b.data[k] === "string") b.data[k] = taparDireccion(b.data[k] as string);
    }
  }
  return evento;
}

export function opcionesAlertas() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: !!dsn && process.env.NODE_ENV === "production",
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "local",
    sendDefaultPii: false,
    // Solo errores: sin medición de rendimiento ni grabación de pantallas (cabe en el plan gratis).
    tracesSampleRate: 0,
    beforeSend: limpiarEvento,
    beforeSendTransaction: limpiarEvento,
  };
}
