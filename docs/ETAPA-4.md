# Etapa 4: recompensas, canjes, historial y estadísticas

## Qué funciona ahora con Supabase (modo live)

| Flujo | Dónde | Quién |
|---|---|---|
| **Canjear recompensa** | *Registrar visita* (tras escanear), *Recompensas* (con confirmación) y ficha del cliente (*Canjear ahora*) | Propietario, administrador y empleados con permiso de canje |
| **Revertir visita** | Ficha del cliente → *Revertir*, con motivo obligatorio | Propietario y administrador |
| **Bloquear / reactivar tarjeta** | Ficha del cliente | Propietario y administrador |
| **Historial** | Panel → *Historial*: visitas, reversiones con motivo, recompensas, canjes y altas, con filtros por tipo, persona, periodo y cliente | Propietario y administrador |
| **Auditoría** | *Historial* → pestaña *Auditoría* | Propietario |
| **Estadísticas** | Panel → *Estadísticas*, periodos de 7, 30 y 90 días | Propietario y administrador |
| **Exportar clientes (CSV)** | *Clientes* → *Exportar CSV* (se abre bien en Excel) | Solo propietario; cada exportación queda en la auditoría |

### Reglas aplicadas en el servidor (Postgres)
- **Doble canje.** Una recompensa solo se canjea una vez, por la restricción `UNIQUE(reward_id)` y el bloqueo de fila. Un doble clic devuelve "ya fue canjeada".
- **Vencimiento.** Una recompensa con la fecha pasada no se puede canjear y se muestra como *Vencida*. El vencimiento se calcula al leer, sin tareas programadas.
- **Tarjeta bloqueada.** No admite visitas ni canjes. Antes de esta etapa solo se frenaban las visitas.
- **Reversión.** Nunca borra la visita original: añade un movimiento −1 con motivo y autor. Si la visita había completado la tarjeta, la recompensa se anula y se devuelven los sellos, siempre que no se haya canjeado; si ya se canjeó, la reversión se rechaza.
- **Estadísticas.** Las calcula la función `business_stats` en la zona horaria del comercio, con todo el historial y no solo lo que el navegador descargó. Las visitas revertidas no cuentan.

## Base de datos
Nueva migración `20261101000006_business_stats.sql`. **Ya está aplicada** en `loyalty-cloud`.
- `business_stats(business_id, days)`: devuelve los agregados del panel.
- `redeem_reward`: rechaza tarjetas bloqueadas y recompensas vencidas.
- `log_customers_export`: deja en la auditoría cada exportación de datos personales.

El panel ahora pide los datos por páginas, porque Supabase devuelve como máximo 1000 filas por consulta. El límite queda en 10 000 filas por tabla y comercio. Por encima de esa cifra, el historial necesitará paginación en el servidor; las estadísticas no, porque ya se calculan en Postgres.

## Pruebas
- `npm run test:db`: 80 casos sobre Postgres en memoria. Los nuevos cubren:
  - recompensas vencidas;
  - bloqueo de tarjetas;
  - estadísticas: permisos, visitas revertidas, series diarias, por hora y por día de la semana, ranking del equipo y distribución de sellos;
  - auditoría de la exportación.
- `npm run db:verify`: 29 casos contra Supabase real, sin modificar datos.
- `npm run db:verify -- --e2e`: 42 casos. Sobre el cliente de prueba "Cliente Verificación" bloquea y reactiva la tarjeta, comprueba que una tarjeta bloqueada no suma visitas, revierte su última visita y audita una exportación vacía.

El canje contra Supabase real no se automatizó para no gastar las recompensas de la semilla. Está cubierto por `test:db`, y se puede probar a mano con la recompensa disponible de Sara Gómez.
