# Guía paso a paso: activar Google Wallet

Para quien configura las cuentas (no hace falta saber programar). El código ya está listo: solo faltan las cuentas y dos claves.
Detalle técnico en [ETAPA-9-WALLET.md](ETAPA-9-WALLET.md).

**Regla de oro:** el archivo JSON de la cuenta de servicio es una llave secreta. No se envía por chat ni correo, no se sube a GitHub y no se guarda en el proyecto. Solo se pega en Vercel.

Costo esperado: $0 en Google (por verificar en la consola; si aparece algún cobro, detenerse).

## Parte 1. Google Cloud (10 minutos)

1. Entre a https://console.cloud.google.com con la cuenta de la empresa.
2. Arriba, junto al logo, pulse el selector de proyectos → **Proyecto nuevo**. Nombre: `lazo-wallet`. Pulse **Crear**.
3. Menú ☰ → **APIs y servicios** → **Biblioteca**. Busque **Google Wallet API** y pulse **Habilitar**.
4. Menú ☰ → **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**.
   - Nombre: `wallet-issuer`. Pulse **Crear y continuar**, luego **Listo** (no hay que asignar roles).
5. Entre a la cuenta recién creada → pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → **Crear**. Se descarga un archivo.
6. Copie el correo de la cuenta de servicio (termina en `iam.gserviceaccount.com`). Lo necesita en la Parte 2.

## Parte 2. Google Pay & Wallet Console (10 minutos)

1. Entre a https://pay.google.com/business/console con la misma cuenta.
2. Cree el perfil de empresa si se lo pide (nombre legal, país Colombia).
3. En el menú, abra **Google Wallet API**. Pulse **Crear cuenta de emisor** (si ya existe, úsela).
4. Anote el **ID de emisor** (Issuer ID): es un número largo.
5. En **Usuarios** (o *Users*), invite el correo de la cuenta de servicio de la Parte 1, con rol **Desarrollador**.
6. En **Gestionar pases** → *Cuentas de prueba*, agregue el correo de Google de la persona que va a probar desde un Android.

## Parte 3. Vercel (5 minutos)

1. Entre a Vercel → proyecto **loyalty-cloud** → **Settings** → **Environment Variables**.
2. Cree estas dos variables, solo en **Production**:
   - `GOOGLE_WALLET_ISSUER_ID` = el Issuer ID.
   - `GOOGLE_WALLET_SERVICE_ACCOUNT` = el contenido completo del archivo JSON. Márquela como **Sensitive**.
3. Vaya a **Deployments** → los tres puntos del último despliegue → **Redeploy**.

## Parte 4. Probar

1. Con el celular Android cuya cuenta agregó como cuenta de prueba, abra la tarjeta de una clienta de prueba.
2. Debe aparecer **Añadir a Google Wallet**. Púlselo y guarde el pase.
3. Registre una visita desde el panel. En unos segundos el pase del celular debe mostrar el sello nuevo.

Si el botón no aparece: revise que las dos variables estén en Production, que se hizo el Redeploy y que no se pegó el JSON cortado.

## Parte 5. Pasar a producción (para todas las clientas)

1. En la consola de Wallet, en la pestaña de la API, pulse **Solicitar acceso de publicación**.
2. Suba una captura del pase y el logo del comercio cuando lo pida. Google revisa el diseño y responde en unos días.
3. **Antes de publicar:** reemplazar el botón provisional por el botón oficial *Add to Google Wallet*, que se descarga de la guía de marca de Google. Se guarda en `public/` y se cambia en `src/components/public/wallet-buttons.tsx`.

## Lista de comprobación

- [ ] Proyecto de Google Cloud creado y Wallet API habilitada
- [ ] Cuenta de servicio y clave JSON (guardada solo en lugar seguro)
- [ ] Cuenta de emisor creada y Issuer ID anotado
- [ ] Cuenta de servicio invitada como Desarrollador
- [ ] Correo de prueba agregado
- [ ] Variables cargadas en Vercel y Redeploy hecho
- [ ] Pase guardado y actualizado en un Android de prueba
- [ ] Acceso de publicación solicitado
- [ ] Botón oficial puesto
