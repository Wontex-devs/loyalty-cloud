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
