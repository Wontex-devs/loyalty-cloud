import * as Sentry from "@sentry/nextjs";
import { opcionesAlertas } from "@/lib/alertas";

/** Alertas de errores en el navegador. Ver src/lib/alertas.ts. */
try {
  Sentry.init(opcionesAlertas());
} catch {}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
