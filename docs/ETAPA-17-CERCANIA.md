# Etapa 17 · Aviso de cercanía en la billetera

Cuando el cliente pasa cerca del local, su celular le recuerda la tarjeta.

## Cómo se activa (comercio)

Ajustes → **Sedes** → Editar (o Nueva sede) → **Ubicación del local**:

- Pegar las coordenadas (en Google Maps, mantener presionado el local y copiar los números, p. ej. `4.6987, -74.0412`),
- o el enlace **completo** de Google Maps (los enlaces cortos `maps.app.goo.gl` no traen las coordenadas),
- o tocar **Estoy en el local** desde el celular estando allí.

Revisar con «ver en el mapa» que el punto caiga en la puerta del local. Dejar el campo vacío apaga el aviso de esa sede.
Una sede inactiva no avisa. Máximo 10 sedes por comercio (límite de Apple y Google).

Al guardar, Lazo actualiza solo los pases ya guardados (iPhone por APNs, Android por la clase de Google).

## Qué ve el cliente

| | iPhone (Apple Wallet) | Android (Google Wallet) |
|---|---|---|
| Qué aparece | La tarjeta en la pantalla bloqueada con «Estás cerca de {comercio}. Te faltan N visitas para …» | Una notificación de Google Wallet |
| Quién decide cuándo | iOS (radio pequeño, sin sonido) | Google (radio y frecuencia los fija Google; no se repite en cada pasada) |
| Requisitos | Tarjeta guardada, ubicación activada | Tarjeta guardada, ubicación y notificaciones de Wallet activadas |

Lazo **no recibe ni guarda la ubicación del cliente**: el cálculo lo hace su celular.

## Técnico

- Migración `20261101000025_sede_ubicacion.sql`: `locations.latitude` y `locations.longitude` (las dos o ninguna, con rangos válidos).
- `src/lib/wallet/geo.ts`: `parseCoordinates` (coordenadas o enlace de Maps) y `placesFrom` (activas, sin repetir, máx. 10).
- Apple: `locations[]` con `relevantText` en `pass.json` (`passJson`).
- Google: `merchantLocations[]` en la clase (`loyaltyClass`); lista vacía las borra.
- `saveLocationAction` llama a `scheduleBusinessWalletSync` para refrescar pases y clase.
- `Permissions-Policy`: `geolocation=(self)` para el botón «Estoy en el local».
- Pruebas: `tests/cercania.test.ts` y la sección «Etapa 25» de `scripts/test-db.mjs`.
