# Etapa 2: Supabase (base de datos, autenticación, roles y RLS)

## Qué se construyó

| Pieza | Archivo |
|---|---|
| Esquema multiempresa (12 tablas, enums, FKs compuestas, índices) | `supabase/migrations/20261101000001_schema.sql` |
| Row Level Security + funciones de autorización | `supabase/migrations/20261101000002_rls.sql` |
| Funciones RPC transaccionales | `supabase/migrations/20261101000003_functions.sql` |
| Planes iniciales | `supabase/migrations/20261101000004_reference_data.sql` |
| Pruebas de seguridad (60 casos) | `scripts/test-db.mjs` → `npm run test:db` |
| Carga de datos de Beauty Club | `scripts/seed.ts` → `npm run db:seed` |
| Clientes Supabase (navegador / servidor / service_role) | `src/lib/supabase/` |
| Refresco de sesión y protección de rutas | `src/proxy.ts` |
| Lecturas bajo RLS y Server Actions | `src/lib/data/queries.ts`, `src/lib/data/actions.ts` |
| Login real (contraseña o enlace por correo), invitaciones | `src/components/auth/`, `src/app/auth/callback`, `src/app/account/password` |

### Dos modos
- **Sin `.env.local`** la app sigue en **modo demo** (Etapa 1, datos en el navegador). Así se puede seguir enseñando el prototipo.
- **Con `.env.local`** pasa a **modo live**: login real, paneles protegidos por sesión y rol, y datos leídos de Postgres a través de RLS.

### Seguridad implementada
- **Aislamiento por comercio en la base de datos.** Cada consulta del panel usa la sesión del usuario y RLS decide qué filas ve. Las claves foráneas compuestas `(id, business_id)` impiden, incluso a nivel de datos, enlazar una tarjeta de un comercio con un cliente de otro.
- **El superadmin ve comercios, planes, usuarios y agregados**, pero **no** los datos personales de los clientes finales.
- **`anon` no tiene acceso a ninguna tabla.** El público solo puede llamar a `join_program` (inscripción) y `get_public_card` (vista mínima de la tarjeta, sin teléfono ni correo).
- **Tarjetas, visitas, recompensas y canjes no se escriben directamente**, ni siquiera por el propietario. Solo mediante RPC que bloquean la fila (`FOR UPDATE`) y validan rol, estado, idempotencia y tiempo mínimo entre visitas.
- **Historial inmutable.** `visits`, `redemptions` y `audit_logs` rechazan `UPDATE`/`DELETE` mediante triggers, también para el superusuario. Si se elimina un usuario, su autoría queda anonimizada.
- **Revertir la visita que completó un ciclo** anula la recompensa si aún no se canjeó. Si ya se canjeó, la reversión se rechaza.
- **Auditoría automática** de visitas, canjes, reversiones, cambios de programa, membresías y acciones de plataforma.
- **La `service_role` solo existe en el servidor** (`import "server-only"`). Se usa únicamente para invitar usuarios de Auth, después de comprobar el rol de quien invita. La membresía se inserta con la sesión del usuario, así que RLS sigue decidiendo.

### Fuera de esta etapa (Etapa 3/4)
En modo live, el registro de clientes, el escaneo con visita y el canje **todavía muestran "se conecta en la Etapa 3"**. Las RPC ya existen y están probadas (`register_visit`, `redeem_reward`, `reverse_visit`, `join_program`, `get_public_card`). Solo falta conectarlas a esas pantallas. `/join` y `/card` siguen funcionando en modo demo.

## Cómo conectar tu proyecto Supabase

1. **Crea un proyecto** en https://supabase.com (región São Paulo, `sa-east-1`, la más cercana a Colombia). Guarda la contraseña de la base de datos.
2. **Aplica las migraciones.** En *SQL Editor* pega y ejecuta los archivos de `supabase/migrations/` **en orden** (0001 → 0004). Si prefieres la CLI: `npx supabase link` y luego `npx supabase db push`.
3. **Configura Auth** (*Authentication → Sign In / Providers*):
   - Desactiva **"Allow new users to sign up"**: solo se entra por invitación.
   - En *URL Configuration*, pon `http://localhost:3000` como *Site URL* y añade `http://localhost:3000/auth/callback` a *Redirect URLs* (más adelante, el dominio real).
4. **Crea `.env.local`** en la raíz del proyecto (ya está en `.gitignore`), copiando `.env.example`. Los valores están en *Project Settings → API*. Escríbelos tú directamente en el archivo; no hace falta pegarlos en el chat.
5. **Carga los datos de demostración** (opcional):
   ```bash
   SEED_SUPERADMIN_EMAIL=tu@correo.com npm run db:seed
   ```
   Crea los usuarios de Beauty Club con contraseñas aleatorias y las guarda en `.seed-credentials.local.json`. Con `SEED_SUPERADMIN_EMAIL`, el superadmin usa tu correo.
6. **Si no usas la semilla**, crea tu usuario en *Authentication → Users → Invite* y nómbrate superadmin en el SQL Editor:
   ```sql
   update public.profiles set platform_role = 'superadmin' where email = 'tu@correo.com';
   ```
7. Reinicia `npm run dev` y entra por `/login`.
8. `npm run db:verify` inicia sesión con cada rol de la semilla contra el proyecto real y comprueba RLS y permisos (19 casos, solo lectura).

## Probar la seguridad sin Supabase

```bash
npm run test:db
```

Este comando aplica las migraciones sobre un Postgres real en memoria (PGlite) y ejecuta 60 comprobaciones: acceso público, aislamiento entre comercios, roles, idempotencia, canje único, reversiones, inmutabilidad, comercio suspendido y validez de la semilla. La simulación de Supabase que usa está en `supabase/tests/supabase-shim.sql`.

## Limitaciones conocidas
- **Volumen de datos.** Los paneles cargan hasta 5.000 filas por tabla y comercio. Basta para el piloto. En la Etapa 4 las estadísticas pasarán a vistas o consultas agregadas con paginación.
- **Límite de inscripciones.** `join_program` es pública. Antes del piloto conviene añadir un límite por IP en el servidor (Etapa 3) y, si se decide, verificación por OTP.
- **Proyecto real `loyalty-cloud` (São Paulo).** Migraciones aplicadas, semilla cargada y `npm run db:verify` con 19/19 correctas.
