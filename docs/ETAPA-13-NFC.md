# Etapa 13: visita por toque NFC

## Qué hace
- El comercio pega una **etiqueta NFC** (calcomanía NTAG213 o NTAG215) en el mostrador.
- La clienta **acerca el celular** a la etiqueta. Se abre `/tap/<comercio>?k=<secreto>`, que registra su visita en la tarjeta guardada en ese celular y le muestra «¡Sello registrado!» con su avance.
- El equipo **no hace nada**. Si el toque falla, sigue valiendo el escáner de QR de siempre.
- Cada visita guarda su origen (`nfc` o `staff`). Las de NFC aparecen en el historial y **se pueden revertir** con motivo, como cualquier otra.

## Cómo se enciende (dueño o administrador)
1. En el panel: **Mi tarjeta digital → Sellar con el celular (NFC)**.
2. Activa «Permitir sellar con el toque» y elige el **tiempo mínimo entre toques** (por defecto 2 horas).
3. Pulsa **Escribir en una etiqueta** (Chrome en Android) y acerca la etiqueta. Si no tienes Android, copia el enlace y escríbelo con una app como NFC Tools.
4. Pega la etiqueta y pruébala con tu propia tarjeta.

## Reglas y seguridad
| Regla | Cómo se cumple |
|---|---|
| El secreto de la etiqueta no lo ve el equipo | Vive en `private.business_nfc`, fuera de la API. Solo lo leen el dueño, el administrador y el superadministrador, con `get_nfc_settings`. |
| Solo el servidor registra el toque | `register_nfc_visit` solo puede llamarla `service_role`, desde `nfcTapAction`. |
| Evitar sellos sin comprar | Debe pasar el tiempo mínimo del programa **o** el del comercio, el que sea mayor. Hay además un freno por IP (30 cada 10 min) y por tarjeta (8 por hora). |
| Etiqueta robada o copiada | «Cambiar el secreto» genera uno nuevo e invalida todas las etiquetas escritas antes. |
| Doble registro | Cada apertura usa una clave de idempotencia nueva y la base rechaza repeticiones. |
| Auditoría | Se registra el origen de cada visita y el cambio de ajustes; el secreto nunca se guarda en la auditoría. |
| Comercio suspendido, NFC apagado o tarjeta bloqueada | No se registra la visita. |

## Cómo está construido
| Archivo | Para qué |
|---|---|
| `supabase/migrations/20261101000015_nfc_checkin.sql` | Columna `visits.source`, tabla privada de ajustes, núcleo `private.record_visit` (compartido con el escáner), `register_nfc_visit`, `get_nfc_settings` y `set_nfc_settings`. |
| `src/lib/data/nfc-actions.ts` | Acciones del servidor: toque y ajustes del panel. |
| `src/app/tap/[slug]/page.tsx` y `src/components/public/nfc-tap.tsx` | Pantalla que se abre al tocar la etiqueta. |
| `src/components/business/nfc-card.tsx` | Sección del panel: encender, tiempo mínimo, enlace, escribir etiqueta y cambiar secreto. |
| `src/components/public/card-screen.tsx` | La tarjeta guarda su enlace en el celular (`localStorage`) para que `/tap` sepa de quién es. |

`register_visit` (el escáner) se reescribió sobre el mismo núcleo sin cambiar sus reglas; las pruebas anteriores siguen pasando.

## Límites conocidos
- **La clienta debe haber abierto su tarjeta una vez en ese navegador.** El toque busca el enlace en el celular. Si la tarjeta se creó en otro navegador, o desde la pantalla de inicio en iPhone (almacenamiento separado), `/tap` le pide crear o abrir su tarjeta y volver a acercar.
- **Una etiqueta es un enlace fijo.** Alguien que la lea con una app podría repetir el toque desde su casa; lo frenan el tiempo mínimo, los frenos de IP y tarjeta, y el historial con reversión. Para más control, hace falta un código que cambie (por ejemplo, una pantalla en el mostrador).
- **Escribir etiquetas** solo funciona en Chrome para Android (Web NFC). Leerlas funciona en Android y en iPhone XS o posteriores.
- **No incluye** el Smart Tap de Google Wallet ni Apple Wallet (el celular como pase en un lector). Es otra etapa, con aprobaciones de Google y Apple.
- **Varias sedes:** hay una sola etiqueta por comercio; las visitas por NFC quedan sin sede.
- En la **demostración** no hay toque NFC: la pantalla lo explica.

## Pruebas
- `npm run test:db`: 213 casos, 28 nuevos en «Etapa 13» (permisos, secreto, reglas de tiempo, rotación, auditoría, reversión, suspensión). El escáner del empleado sigue igual.
- `npm run test:unit` y `npm run typecheck`: sin errores.
- Se vieron en pantalla los cuatro estados de `/tap` y el panel en modo demostración.
- **Sin probar:** el flujo real contra Supabase (`db:verify`), la escritura de una etiqueta con un Android y el toque con un celular de verdad. Hacerlo antes de ofrecerlo a un cliente.

## Para activarlo en producción (lo haces tú)
1. Aplicar la migración `20261101000015_nfc_checkin.sql` en el proyecto de producción (editor SQL de Supabase, o `supabase/setup.sql` en un proyecto nuevo).
2. Publicar la app (Pull Request y unir a `main`).
3. En el panel de cada comercio: encender el NFC, escribir la etiqueta y probarla.

## El celular recuerda al cliente (19 nov 2026)

Al tocar la etiqueta, Lazo reconoce al cliente por la tarjeta guardada en el navegador del celular. Safari borra lo que guardan las páginas a los ~7 días sin visitas, y por eso a veces salía «Aún no tienes tarjeta». Ahora:

1. **Cookie del servidor** (`lazo_tarjetas`, solo HTTP, hasta 400 días). Se pone al inscribirse, al abrir la tarjeta (también desde «Ver mi tarjeta» en la billetera) y en cada toque, que la renueva. La pantalla del toque busca primero en lo que guardó la página y después en esta cookie.
2. **Escribir el celular en la misma pantalla.** Si aun así no lo reconoce, el cliente escribe su número de celular (el celular ofrece autocompletarlo) y el sello se suma ahí mismo. Solo con la etiqueta del mostrador (su enlace secreto), con el tiempo mínimo entre visitas y máximo 6 intentos cada 10 minutos por conexión. Para proteger los datos, al sumarlo así no se muestra el nombre ni se abre la tarjeta, ni se guarda en ese celular (cambio del 19 nov 2026: antes pedía también nombre y apellido).
3. **Aviso en la inscripción** cuando se abre desde Instagram, Facebook, WhatsApp o TikTok: la tarjeta quedaría guardada en esa app y el toque, que abre Safari o Chrome, no la encontraría.

No verificado en un iPhone real: cuánto conserva Safari la cookie (según la documentación de WebKit, las cookies que pone el servidor no tienen el límite de 7 días).

## Revisión de seguridad (19 nov 2026)

- **Sumar por celular, dentro de Postgres** (`register_nfc_visit_by_phone`, migración 20261101000035): primero se comprueba la etiqueta (si falla, siempre `INVALID_TAG`, sin mirar el número) y después el número. Número que no existe, tarjeta bloqueada o datos borrados responden igual. Límite guardado en la base: 10 intentos cada 10 minutos por conexión (HMAC de la IP) y 120 por comercio; los fallidos también cuentan. Al sumar así no se muestran sellos ni nombre.
- **Reintentos sin sello doble:** la pantalla del toque usa la misma clave al pulsar «Intentar de nuevo», y el escáner la misma para el mismo código durante un minuto (avisa «ya se sumó hace un momento» en vez de callar).
- **Celulares del panel:** si el navegador tiene la sesión del panel, no se recuerdan tarjetas (ni cookie ni en la página), para que quien atiende no termine sumando sellos a un cliente al probar la etiqueta.
- El freno rápido por IP del toque subió a 120 cada 10 minutos (los clientes de un local comparten la wifi) y el límite en memoria se limpia solo.

## Límite por día y estar en el local (21-nov-2026, migración 0037)

**El problema:** el enlace de la etiqueta es fijo. Quien lo guarde (una foto, un marcador) puede abrirlo desde
su casa y sumarse sellos. Antes solo lo frenaba el tiempo mínimo entre toques (2 horas): un sello cada 2 horas.

**Qué se agregó** (panel → Tarjeta, QR y NFC → Sellar con el celular):
- **Sellos por día con el toque** (por defecto **1**, de 1 a 20): una tarjeta no suma más de eso por NFC en un día
  (día del comercio). Los sellos revertidos no cuentan. Repetir el mismo toque (reintento) no choca con el límite.
- **Exigir estar en el local** (apagado por defecto): el celular comparte su ubicación y debe estar a menos de
  200 m de una sede con ubicación guardada. La ubicación se compara en la base y **no se guarda**. Solo se puede
  activar si hay al menos una sede con ubicación.
  - En el sello escribiendo el celular, la ubicación se comprueba **antes** de buscar el número: lejos del local,
    la respuesta es la misma exista o no el número.
  - Si el cliente no da el permiso, se le suma el sello escaneando su QR desde el panel.

**Límites honestos:** la ubicación la reporta el celular; alguien con conocimientos técnicos puede falsearla.
Con las dos medidas, lo máximo que logra es un sello al día. La forma sin riesgo sigue siendo que el equipo
escanee el QR de la tarjeta. Si se sospecha que el enlace circula, se cambia el secreto de la etiqueta.

**En la web** se corrigieron los textos: ya no dicen que el sello «se marca solo»; dicen que el cliente acerca
el celular y escribe su número.
