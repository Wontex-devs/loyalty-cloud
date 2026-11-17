# Etapa 9: Google Wallet

## Qué hace
- La tarjeta de la clienta muestra **"Añadir a Google Wallet"** en Android y en computador. En iPhone aparece Apple Wallet (Etapa 15).
- El pase muestra:
  - el logo y los colores del comercio;
  - el nombre de la clienta y los sellos (por ejemplo **6/9**);
  - las recompensas disponibles y la promoción del día;
  - el **mismo QR** de la tarjeta web, para que el escáner de caja funcione igual.
- **El pase se actualiza solo** al registrar una visita, al canjear, al revertir y al bloquear o reactivar la tarjeta. La actualización ocurre *después* de responder en caja, así que no la hace más lenta.
- Si el comercio cambia su marca, su programa o su configuración, se actualiza el diseño de todos sus pases.
- **No se guardan datos personales en Google más allá del nombre.** El pase no incluye teléfono, correo ni IDs internos; se identifica con el token público.

## Cómo está construido
| Archivo | Para qué |
|---|---|
| `src/lib/wallet/pass.ts` | Contenido del pase, común a todas las billeteras. Apple Wallet usará este mismo archivo. |
| `src/lib/wallet/google.ts` | Clase (diseño del comercio), objeto (tarjeta de la clienta), firma RS256 del JWT y llamadas a la API. No usa librerías externas. |
| `src/lib/wallet/config.ts` | Lee las credenciales en el servidor. Sin credenciales todo queda apagado. |
| `src/lib/wallet/sync.ts` | Actualiza los pases con `after()` desde las acciones del panel, con la sesión del usuario (RLS). |
| `src/app/card/[token]/google-wallet` | Genera el enlace firmado y redirige a Google. |

**Pruebas:** `tests/wallet.test.ts` comprueba IDs, contenido, que no viaje el teléfono y la firma del JWT con una clave de prueba.

## Lo que falta: crear las cuentas de Google (lo haces tú, con mi ayuda)
1. **Google Cloud** (console.cloud.google.com):
   1. Crea un proyecto, por ejemplo `loyalty-cloud`.
   2. En *APIs y servicios*, activa **Google Wallet API**.
   3. En *IAM → Cuentas de servicio*, crea `wallet-issuer`.
   4. En *Claves → Agregar clave → JSON*, descarga el archivo JSON. **Es secreto: no lo compartas ni lo subas a GitHub.**
2. **Google Pay & Wallet Console** (pay.google.com/business/console):
   1. Crea la cuenta de emisor. Anota el **Issuer ID**, un número largo.
   2. En *Usuarios*, invita el correo de la cuenta de servicio (`wallet-issuer@…iam.gserviceaccount.com`) como **Desarrollador**.
   3. En *Google Wallet API → cuentas de prueba*, añade tu correo de Google para probar antes de la aprobación.
3. **Vercel → loyalty-cloud → Settings → Environment Variables** (solo Production):
   - `GOOGLE_WALLET_ISSUER_ID` = el Issuer ID.
   - `GOOGLE_WALLET_SERVICE_ACCOUNT` = el contenido completo del JSON. Márcala como **Sensitive**.
4. Vuelve a publicar el sitio. El botón aparece en las tarjetas.
5. **Aprobación de Google:** mientras tanto solo pueden guardar el pase las cuentas de prueba. Para todas las clientas, pide el acceso de publicación en la consola. Google revisa el diseño en unos días.

**Botón:** la tarjeta usa el botón oficial *Add to Google Wallet* de la guía de marca de Google (`public/google-wallet/`, versión es-419).

## Apple Wallet
Ya está construido: ver [ETAPA-15-APPLE-WALLET.md](ETAPA-15-APPLE-WALLET.md).
