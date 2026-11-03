# Etapa 12: avisos en la billetera (Google Wallet)

## Qué hay de nuevo
| Función | Dónde | Detalle |
|---|---|---|
| **Avisos automáticos** | *Campañas → Avisos automáticos* | Sello nuevo, te falta 1, premio listo, cumpleaños y te extrañamos. El comercio activa o apaga cada uno; "te extrañamos" se envía tras 14 a 180 días sin venir (45 por defecto). |
| **Campaña con un botón** | *Campañas → Aviso a la billetera* | Envía un aviso a todo el grupo elegido (cerca del premio, cumpleaños del mes, etc.). `{nombre}` se cambia por el primer nombre. |
| **Últimos avisos** | *Campañas* | Qué se envió, a quién y si llegó (enviado, sin billetera o falló). |
| **Demo** | Tarjeta de la clienta | La notificación se simula en la pantalla de la tarjeta al registrar una visita o enviar una campaña. |

## Reglas
- **Uno por visita.** Tras registrar una visita se envía un solo aviso, el más importante: premio listo, luego te falta 1, luego sello nuevo.
- **Sin repeticiones.** Cada aviso se registra una sola vez por tarjeta (`card_id` + `ref`). Reintentar la visita o el proceso diario no lo repite.
- **Consentimiento.** Cumpleaños, te extrañamos y campañas solo llegan a quien aceptó recibir mensajes. Los avisos de visita son informativos.
- **Frecuencia.** Máximo una campaña por cliente a la semana. Google permite hasta 3 avisos al día por tarjeta.
- **Te extrañamos.** Solo a quien dejó de venir hace poco (entre N y N+30 días). Al activarlo no se escribe a clientes de hace años.
- **En Android**, Google muestra un aviso genérico y el texto completo se ve al abrir la tarjeta. En iPhone (Apple Wallet, Etapa 13) el texto sale en la pantalla de bloqueo.

## Cómo está construido
| Archivo | Para qué |
|---|---|
| `supabase/migrations/20261101000013_wallet_notifications.sql` | `businesses.wallet_notifications` (ajustes), tabla `wallet_notifications`, `update_wallet_settings`, `queue_wallet_campaign` y `wallet_daily_candidates` (esta última solo para el servidor). |
| `src/lib/wallet/messages.ts` | Textos de los avisos, compartidos por el servidor y la demo. |
| `src/lib/wallet/google.ts` | `addMessage`: mensaje con aviso (`TEXT_AND_NOTIFY`), visible 30 días en el pase. |
| `src/lib/wallet/notify.ts` | Registra los avisos sin duplicarlos y los entrega a Google, de a 8 en paralelo. |
| `src/lib/wallet/sync.ts` | Tras una visita: actualiza el pase y envía su aviso, después de responder en caja. |
| `src/app/api/cron/wallet-daily/route.ts` | Proceso diario de cumpleaños y te extrañamos. Exige `CRON_SECRET`. |
| `vercel.json` | Vercel Cron: todos los días a las 10:00 de Colombia (15:00 UTC). |
| `src/components/business/wallet-notices.tsx` | Campaña, ajustes y últimos avisos en el panel. |

## Para activarlo en producción (lo haces tú, sin enviarme las claves)
1. **Vercel → loyalty-cloud → Settings → Environment Variables** (Production):
   - `GOOGLE_WALLET_ISSUER_ID` = `3388000000023234390`;
   - `GOOGLE_WALLET_SERVICE_ACCOUNT` = el contenido del JSON de la cuenta de servicio, marcado como **Sensitive**;
   - `CRON_SECRET` = una frase larga al azar (por ejemplo 40 letras y números), también **Sensitive**. Vercel la envía sola al ejecutar el proceso diario.
2. Yo aplico la migración en producción y publico.
3. **Aprobación de Google:** mientras tanto solo las cuentas de prueba (y los administradores del emisor) pueden guardar el pase y recibir avisos.

## Pruebas
- `npm run test:db`: 185 casos, 24 nuevos:
  - permisos por rol y por comercio;
  - ajustes inválidos;
  - campaña solo a quien aceptó mensajes y tiene la tarjeta activa;
  - límite semanal;
  - registro de solo lectura;
  - proceso diario: cumpleaños, te extrañamos, tarjetas bloqueadas y aviso apagado.
- `npm run test:unit`: 30 casos, 8 nuevos (textos de los avisos y mensaje de Google).
- `npm run db:verify -- --e2e` contra el proyecto de pruebas: 83 de 83, 11 nuevos.
- `next build` sin errores.
- En el navegador, en modo demo:
  - campaña a 22 clientas;
  - el segundo envío queda bloqueado por el límite semanal;
  - aviso de sello nuevo al registrar una visita;
  - notificación simulada en la tarjeta.

**No probado todavía:** la entrega real a Google Wallet. Necesita las claves de Google en `.env.local` o en Vercel.
