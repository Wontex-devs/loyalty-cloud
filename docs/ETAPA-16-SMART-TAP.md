# Etapa 16: Lector NFC en el mostrador (Smart Tap de Google Wallet)

> **Retirada del panel (18 de noviembre de 2026):** la pantalla «Lector NFC» se quitó del panel del comercio. Las tarjetas NFC del mostrador las entrega Lazo en persona. La pantalla se puede recuperar del historial de Git (`src/app/business/[slug]/lector/page.tsx`); lo demás de este documento queda como referencia.

El cliente acerca su celular Android, con la tarjeta guardada en Google Wallet, a un lector NFC conectado al computador de la caja. La visita se registra sola: no hay que abrir la app ni escanear nada.

Sin `GOOGLE_WALLET_SMART_TAP=1` los pases de Google quedan como antes. La pantalla **Lector NFC** funciona igual con un lector de códigos QR en modo teclado, que lee el QR de la tarjeta web.

## Cómo funciona
1. **El pase.** Con Smart Tap encendido, cada comercio en Google Wallet lleva `enableSmartTap` y nuestro emisor como `redemptionIssuers`, y cada tarjeta lleva su token como `smartTapRedemptionValue`.
2. **El lector.** Un VTAP100 en modo teclado (HID) lee el pase con la clave privada de Smart Tap y escribe el token, seguido de Enter, como si fuera un teclado.
3. **La pantalla «Lector NFC».** Está en el panel del comercio, en *Más opciones*. Recibe esa lectura y registra la visita con las mismas reglas de siempre: tiempo mínimo entre visitas, sede, promociones y premios. Muestra en grande «¡Listo, Ana! Lleva 3 de 8 sellos».
4. **Pases que ya estaban guardados** antes de encender Smart Tap. Google envía el ID del pase (`emisor.card-<token>`) hasta que el pase se actualice; la pantalla también lo entiende.

| Archivo | Qué hace |
|---|---|
| `src/lib/wallet/google.ts` | Campos de Smart Tap en la clase y el objeto, solo si está encendido. |
| `src/lib/wallet/smart-tap.ts` | Interpreta lo que escribe el lector: token, ID del pase o URL de la tarjeta. |
| `src/app/business/[slug]/lector/page.tsx` | Pantalla del computador de la caja. |
| `src/lib/data/nfc-actions.ts` | `prepareSmartTapAction`: al abrir la pantalla, actualiza la clase del comercio en Google. |
| `scripts/smart-tap-keys.ts` | Genera las claves (ECDSA P-256) fuera del proyecto. |
| `tests/smart-tap.test.ts` | Pruebas del pase y de las lecturas. |

## Activarlo (paso a paso)

**Regla de oro:** la clave privada (`private1.pem`) solo va al lector. No se envía por chat ni correo, no se sube a GitHub y no va a Vercel.

### 1. Comprar el lector
**VTAP100** de Dot Origin, certificado para Google Smart Tap y Apple VAS (unas £139 + IVA). Pedir la versión USB con emulación de teclado.

### 2. Generar las claves (en el Mac, Terminal, dentro del proyecto)
```bash
npm run smart-tap:keys -- ~/lazo-smart-tap 1
```
Se crean dos archivos en `~/lazo-smart-tap`:
- `public1.pem`: la clave pública, para Google;
- `private1.pem`: la clave privada, para el lector.

El script no deja guardarlas dentro del proyecto.

### 3. Google Pay & Wallet Console
1. Entre a **Google Wallet API → Funciones adicionales → Toque inteligente → Agregar una clave**.
2. Pegue el contenido de `public1.pem` y la versión `1`.
3. Anote el **Collector ID** que muestra Google.

### 4. Configurar el lector
1. Conecte el VTAP100 al computador: aparece como una memoria USB.
2. Copie `private1.pem` a la memoria.
3. En `config.txt` ponga:
   - `ST1CollectorID=<Collector ID de Google>`
   - `ST1KeySlot=1`
4. Active la salida como teclado (que escriba el valor leído y luego Enter), según el manual del VTAP100.
5. Expulse la memoria y desconecte y vuelva a conectar el lector.

### 5. Vercel
- Agregue `GOOGLE_WALLET_SMART_TAP=1` (entorno Production).
- Haga **Redeploy** del último despliegue.

### 6. Probar
1. En el computador de la caja, abra el panel del comercio → *Más opciones* → **Lector NFC**. Al abrirla, el comercio queda listo para Smart Tap en Google.
2. Con un Android que tenga la tarjeta del comercio en Google Wallet, acérquelo al lector con la pantalla encendida.
3. Debe aparecer «¡Listo, …!» y la visita queda en el historial.

## Límites
- **Solo Android con Google Wallet.** En iPhone, el pase de Apple Wallet necesita el certificado NFC de Apple (VAS), que se pide aparte: ver la Etapa 15.
- **La pantalla debe estar abierta y con el foco.** Si se cambia de ventana, el lector escribe en otro lado. La pantalla recupera el foco sola cuando se toca en cualquier parte.
- **Una clave para toda la plataforma.** Todos los comercios usan el mismo Collector ID, y un lector solo registra tarjetas del comercio cuya pantalla está abierta.
