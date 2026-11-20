import * as Sentry from "@sentry/nextjs";
import { opcionesAlertas } from "@/lib/alertas";

/** Alertas de errores del servidor (Node y Edge). Ver src/lib/alertas.ts. */
export function register() {
  Sentry.init(opcionesAlertas());
}

// Errores en páginas, acciones y rutas del servidor.
export const onRequestError = Sentry.captureRequestError;
