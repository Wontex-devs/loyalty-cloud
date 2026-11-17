# Etapa 15: Apple Wallet

La tarjeta de la clienta muestra **"Añadir a Apple Wallet"** en iPhone, y el pase se actualiza solo con cada visita, igual que en Google Wallet.

Sin las variables de Apple en Vercel no cambia nada: el botón no aparece y todo sigue como antes.

## Qué hace
- **El pase.** Al tocar el botón, el iPhone descarga un `.pkpass` firmado y ofrece añadirlo. Lleva:
  - el nombre, los colores y el logo del comercio;
  - los sellos (6/9) y el premio;
  - el nombre de la clienta y su progreso;
  - al reverso: promoción del día, último mensaje del comercio y enlace a la tarjeta web.

  No lleva código de barras (igual que Google): los sellos se suman en caja o con el toque NFC.
- **Actualizaciones.** El iPhone se registra en nuestro servicio web (`/api/apple-wallet/v1/...`, el protocolo de Apple). Cuando cambia la tarjeta:
  1. se le avisa por **APNs** (el servicio de avisos de Apple);
  2. el iPhone descarga el pase nuevo;
  3. muestra una notificación como «Te faltan 2 visitas para Manicura gratis».

  Esto ocurre al sumar un sello, canjear o revertir, cuando el comercio cambia su marca o programa, y con las campañas y los avisos diarios.
- **Conteos del panel.** Un aviso de campaña, de cumpleaños o de visita cuenta como «Enviado» si llegó por Google Wallet o a algún iPhone con el pase (APNs respondió 200); «Sin billetera» si no tiene la tarjeta en ninguna.
- **Ajustes del comercio.** Se respetan los avisos que el comercio apagó en su panel: sello nuevo, te falta 1 y premio listo.

## Archivos
| Archivo | Qué hace |
|---|---|
| `src/lib/wallet/apple.ts` | `pass.json`, firma PKCS#7 (con `node:crypto`, sin librerías) y ZIP del `.pkpass`. |
| `src/lib/wallet/apple-server.ts` | Arma el pase de una tarjeta (con imágenes y mensaje vigente) y avisa a los iPhone por APNs. |
| `src/lib/wallet/apple-wwdr.ts` | Certificado público intermedio de Apple (WWDR G4), que va dentro de cada pase. |
| `src/app/card/[token]/apple-wallet/route.ts` | Descarga del pase desde la tarjeta. |
| `src/app/api/apple-wallet/v1/**` | Servicio web: registrar y borrar dispositivos, decir qué cambió, entregar el pase nuevo y recibir registros de error. |
| `supabase/migrations/20261101000020_apple_wallet.sql` | Tabla `apple_wallet_registrations`, que solo puede leer el servidor. |
| `tests/apple-wallet.test.ts` | Contenido, tokens, ZIP y firma verificada con OpenSSL. |

## Activarlo (paso a paso)

**Regla de oro:** la clave privada (`lazo-pass.key`) es secreta. No se envía por chat ni por correo, no se sube a GitHub y solo se pega en Vercel.

### 1. Apple Developer (USD 99 al año)
1. Inscríbase en https://developer.apple.com/programs/enroll.
   - **Como persona:** sale en uno o dos días.
   - **Como empresa:** pide un número D-U-N-S (gratis) y puede tardar una o dos semanas. Así, en el iPhone aparece el nombre de la empresa.
2. Anote el **Team ID**: 10 caracteres, en *Membership details*.

### 2. Clave y solicitud de certificado (en el Mac, Terminal)
```bash
mkdir -p ~/lazo-apple && cd ~/lazo-apple
openssl req -new -newkey rsa:2048 -nodes -keyout lazo-pass.key -out lazo-pass.csr -subj "/CN=Lazo Pass/C=CO"
```
Queda `lazo-pass.csr`, que se sube a Apple, y `lazo-pass.key`, que es secreta y se queda en el Mac.

### 3. Pass Type ID y certificado
1. En https://developer.apple.com/account/resources/identifiers abra **+** → **Pass Type IDs**.
   - Descripción: `Lazo`.
   - Identificador: `pass.com.wontexdevs.lazo`.
2. Abra el identificador → **Create Certificate** → suba `lazo-pass.csr` → descargue `pass.cer` a `~/lazo-apple`.
3. Conviértalo a PEM:
   ```bash
   cd ~/lazo-apple && openssl x509 -inform DER -in pass.cer -out lazo-pass.pem
   ```

### 4. Vercel (Settings → Environment Variables, entorno Production)
| Variable | Valor |
|---|---|
| `APPLE_WALLET_PASS_TYPE_ID` | `pass.com.wontexdevs.lazo` |
| `APPLE_WALLET_TEAM_ID` | el Team ID |
| `APPLE_WALLET_CERT` | `base64 -i ~/lazo-apple/lazo-pass.pem \| pbcopy` y pegar |
| `APPLE_WALLET_KEY` | `base64 -i ~/lazo-apple/lazo-pass.key \| pbcopy` y pegar |
| `APPLE_WALLET_AUTH_SECRET` | `openssl rand -hex 32 \| pbcopy` y pegar |

Después: **Redeploy** del último despliegue.

### 5. Base de datos
Aplicar la migración `20261101000020_apple_wallet.sql` en el proyecto de producción (SQL editor de Supabase), antes de configurar Vercel.

### 6. Botón oficial
Ya está puesta: la insignia oficial de Apple en español de Latinoamérica (`public/apple-wallet/agregar-a-apple-wallet-es-mx.svg`, del paquete ESMX descargado el 17-nov-2026 aceptando el Apple Wallet Marketing Artwork License Agreement). No se puede alterar su forma ni su color. Se descarga en https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/.

### 7. Probar
Con un iPhone, abrir una tarjeta, tocar el botón y añadir el pase. Registrar una visita: en menos de un minuto el pase debe mostrar el sello nuevo y una notificación.

## Pendiente
- **NFC en Apple Wallet:** el pase se lee tocando el lector con el iPhone. Requiere un certificado aparte que Apple concede a pocos (lectores certificados VAS). Va después.
- **Renovación anual:** el certificado vence al año. Al renovarlo, los pases ya guardados siguen funcionando, siempre que no se cambie `APPLE_WALLET_AUTH_SECRET`.
