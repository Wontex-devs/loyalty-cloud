# Etapa 8: más comercios en la plataforma

## Qué hay de nuevo
| Función | Dónde | Detalle |
|---|---|---|
| **Asistente de alta** | Panel → *Programa → Primeros pasos* y aviso en el Dashboard | Cinco pasos con su formulario en la misma pantalla: negocio y datos legales, programa (visitas, recompensa y sellos de regalo), marca (iniciales y paletas de color), equipo (opcional) y primera clienta (cartel y QR). Se marcan solos según los datos del comercio, y el menú deja de mostrarlo al terminar. |
| **Límites del plan aplicados** | Base de datos, *Configuración → Plan* y *Empleados* | Starter: 300 clientes, 2 personas de equipo y 1 sede. Pro: 2.000 clientes, 10 personas y 3 sedes. Business: sin límites. *Configuración* muestra el uso con barras, el Dashboard avisa al llegar al 80 % de clientes y *Empleados* bloquea invitaciones cuando el equipo está completo. |
| **Sedes** | *Configuración → Sedes* | Se crean, se renombran, se activan y se desactivan, sin borrarlas. Si hay más de una sede activa, *Registrar visita* pide elegirla y la recuerda en cada dispositivo. *Estadísticas* muestra las visitas por sede. |
| **Cambio de plan** | Plataforma → *Establecimientos → (comercio)* | Solo el superadmin. El cambio aplica los nuevos límites de inmediato y queda en la auditoría. |

### Reglas en la base de datos
- **Cupo de clientes.** Con el cupo lleno no se inscriben clientas nuevas (`PLAN_LIMIT_CUSTOMERS`), pero las que ya existen siguen recuperando su tarjeta.
- **Equipo.** Al activar a alguien más de lo que permite el plan se rechaza con `PLAN_LIMIT_STAFF`. Cambiar los permisos del equipo actual no cuenta como alta.
- **Sedes.** Se aplica el límite de sedes activas (`PLAN_LIMIT_LOCATIONS`). Una visita solo se puede asignar a una sede activa del mismo comercio (`INVALID_LOCATION`).
- **Cambio de plan.** Solo el superadmin, con `set_business_plan`.

## Base de datos
Nueva migración `20261101000010_plans_locations.sql`:
- tabla `locations`, columnas `visits.location_id` y `plans.max_locations`;
- trigger `enforce_plan_limits`;
- nuevas versiones de `join_program` y `business_stats`;
- `register_visit` se elimina y se vuelve a crear porque cambian sus parámetros.

| Proyecto | Estado |
|---|---|
| Pruebas (`loyalty-cloud`) | ✅ Aplicada |
| Producción (`loyalty-cloud-prod`) | ✅ Aplicada y publicada en Vercel (prueba del sitio: 16 de 16) |

## Pruebas
- `npm run test:db`: 124 casos, 14 de ellos nuevos (límites, sedes y cambio de plan).
- `npm run test:unit`: 18 casos.
- `npm run db:verify -- --e2e`: 56 casos contra el proyecto de pruebas.
- Revisado en el navegador, en modo demo: el asistente, el uso del plan, crear dos sedes y el selector de sede en el escáner.
- Corregido durante la revisión: el formulario de sedes estaba dentro del de *Configuración* y pulsar Enter enviaba el formulario equivocado.

## Pendiente para más adelante
- **Varios programas por comercio**, por ejemplo uno para uñas y otro para pestañas. El modelo de datos ya lo permite, pero las pantallas asumen un programa.
- **Alta de comercios sin superadmin**, es decir, autoservicio. Queda para cuando se definan los pagos.
