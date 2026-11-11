# Arquitectura: plataforma de fidelización de marca blanca

> Estado: **Etapa 3 completada** (inscripción, QR, tarjetas y visitas reales; ver [ETAPA-3.md](ETAPA-3.md)). Etapa 2 (Supabase: esquema, Auth, roles y RLS; ver [ETAPA-2-SUPABASE.md](ETAPA-2-SUPABASE.md)).
> La app necesita `.env.local` con las variables de Supabase (ver `.env.example`). Ya no existe el modo de demostración.

## 1. Punto de partida

La carpeta del proyecto estaba **vacía** (sin código, dependencias ni Git) y el equipo no tenía Node.js.
Se instaló Node.js 22 LTS de forma local en `~/.local/node` (sin permisos de administrador) y el proyecto se creó desde cero.

## 2. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript estricto | SSR para las páginas públicas, Server Actions para las mutaciones (Etapa 2+) |
| Estilos | Tailwind CSS v4 con tokens propios | Sistema visual tipo Linear/Stripe; color de marca por tenant con variables CSS |
| Validación | Zod 4 | Los mismos esquemas en formularios y en el servidor |
| Datos / auth / archivos | Supabase (Postgres + Auth + Storage), a partir de la Etapa 2 | RLS nativo para aislar a cada comercio |
| QR | `qrcode.react` (SVG) | Sin servicios externos |
| Iconos | `lucide-react` | |

Es un **monolito modular**, sin microservicios.

## 3. Estructura

```
src/
  app/
    login/                    Entrada (simula sesión por rol en la Etapa 1)
    admin/                    Panel del SUPERADMIN
      page.tsx                  Dashboard de la plataforma
      businesses/ (+[id], new)  Establecimientos: listado, ficha, alta, suspender/activar
      users/ plans/ analytics/ settings/
    business/[slug]/          Panel del COMERCIO (tenant en la URL)
      page.tsx                  Dashboard
      scan/                     Registrar visita (escáner + búsqueda + canje)
      customers/ (+[id])        Clientes e historial con reversiones
      rewards/                  Recompensas y canjes
      program/                  Mi programa (reglas y recompensa)
      card-design/              Mi tarjeta digital (marca blanca + QR de inscripción)
      staff/ analytics/ settings/
      campaigns/ promotions/    "Próximamente" (sin desarrollar)
    join/[slug]/              PÚBLICO: inscripción del cliente
    card/[token]/             PÚBLICO: tarjeta digital del cliente
  components/
    ui/                       Primitivas (Button, Card, Table, Badge, Field…)
    layout/app-shell.tsx      Sidebar + topbar responsive compartidos
    loyalty/loyalty-card.tsx  Tarjeta premium (pública, editor, escáner)
    business/ admin/          Shells, gráficos y selectores por panel
  lib/
    domain/                   ⚑ Núcleo independiente de la UI
      types.ts                  Entidades = tablas de Supabase
      loyalty-engine.ts         Reglas de negocio puras (visitas, recompensas, canjes, reversiones)
      schemas.ts                Validaciones Zod
      permissions.ts            Matriz rol → permisos
docs/ARQUITECTURA.md
```

**Regla clave:** las pantallas consumen `useScope()` / `useData()` (`lib/data/store.tsx`), que llena `LiveProvider` con datos de Supabase bajo RLS; las escrituras van a Server Actions. `lib/domain` no cambia.

## 4. Multiempresa (multi-tenant)

- Base de datos compartida y **`business_id` en cada tabla operativa** (lógica de tenant por fila).
- Aislamiento garantizado por **RLS en Postgres**, no por filtros del frontend.
- El panel recibe el tenant por la URL (`/business/[slug]`). El servidor vuelve a comprobar la membresía en cada petición.
- El superadmin solo ve agregados. Los datos personales de los clientes quedan dentro de cada comercio.

### Modelo de datos (borrador para la Etapa 2)

```
plans(id, name, price_monthly, max_customers, max_staff, max_programs, features jsonb)
businesses(id uuid, slug unique, name, category, city, status, plan_id, branding jsonb, timezone, created_at)
profiles(id = auth.users.id, full_name, email, platform_role['superadmin'|'user'])
business_memberships(id, business_id, profile_id, role['owner'|'admin'|'staff'], can_redeem, active)
    UNIQUE(business_id, profile_id)
loyalty_programs(id, business_id, name, stamps_required, reward_name, reward_description,
                 min_minutes_between_visits, reward_expiry_days, terms, active)
customers(id, business_id, full_name, phone_e164, email, terms_accepted_at,
          marketing_consent, marketing_consent_at)
    UNIQUE(business_id, phone_e164)                 -- evita registros duplicados
loyalty_cards(id, business_id, program_id, customer_id, public_token unique,
              status, current_stamps, total_visits, last_visit_at)
    UNIQUE(program_id, customer_id)
visits(id, business_id, card_id, kind['visit'|'reversal'], delta(+1|-1),
       reverses_visit_id unique null, reason, staff_id, idempotency_key, created_at)
    UNIQUE(business_id, idempotency_key)             -- evita el doble registro
    -- sin UPDATE/DELETE: ledger de solo inserción
rewards(id, business_id, card_id, program_id, name, status, earned_at, expires_at)
redemptions(id, business_id, reward_id UNIQUE, card_id, staff_id, created_at)  -- evita el doble canje
audit_logs(id, business_id null, actor_id, action, entity, entity_id, metadata jsonb, created_at)
campaigns(id, business_id, ...)                      -- futuro
```

### Estrategia RLS (Etapa 2)

- Funciones `SECURITY DEFINER` estables: `is_superadmin()`, `is_member(business_id)`, `has_role(business_id, roles[])`.
- `SELECT` en las tablas operativas: `is_member(business_id) OR is_superadmin()`.
- Las mutaciones críticas (registrar una visita, canjear, revertir) **no** se hacen con `INSERT` directo desde el cliente. Pasan por **funciones RPC transaccionales** (`register_visit`, `redeem_reward`, `reverse_visit`) que comprueban rol, estado, idempotencia y límites con `SELECT … FOR UPDATE` sobre la tarjeta.
- `visits` y `audit_logs`: sin políticas de `UPDATE`/`DELETE` (inmutables).
- Páginas públicas (`/join`, `/card`): se resuelven **en el servidor** con un cliente de servicio limitado y devuelven una vista mínima (nombre, sellos, recompensa). Nunca se expone el teléfono ni el correo, y nunca llega la `service_role` al navegador.

## 5. Reglas de negocio y seguridad

| Riesgo | Mitigación |
|---|---|
| Adivinar tarjetas | `public_token` de 128 bits aleatorios (base64url, 22 caracteres). Nunca IDs secuenciales en la URL ni en el QR |
| Cliente duplicado | Teléfono normalizado a E.164 + `UNIQUE(business_id, phone)`. Si ya existe, se devuelve su tarjeta |
| Doble visita (doble clic, reintento de red) | Clave de idempotencia por operación + tiempo mínimo configurable entre visitas (`TOO_SOON`) |
| Doble canje | `UNIQUE(redemptions.reward_id)` + `UPDATE rewards SET status='redeemed' WHERE status='available'` |
| Correcciones | Nunca se borran visitas: se inserta una `reversal` (−1) con motivo obligatorio y auditoría |
| Permisos | Matriz en `permissions.ts`, aplicada también en Server Actions y RLS. El empleado solo canjea si tiene `can_redeem` |
| Datos personales | Aceptación de términos con fecha + consentimiento de marketing **separado y opcional**, también con fecha |
| Secretos | Solo `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` en el cliente. `SERVICE_ROLE` únicamente en el servidor (`.env.example`) |
| Comercio suspendido | No acepta inscripciones ni visitas (validación en el servidor) |

Todas estas reglas ya están programadas en `lib/domain/loyalty-engine.ts` y se pueden probar en el prototipo, por ejemplo intentando registrar dos visitas seguidas.

## 6. Preparado para Apple Wallet / Google Wallet (sin implementarlo)

- El motor emite **eventos de dominio** (`card.updated`, `reward.earned`, `reward.redeemed`). Más adelante, un *outbox* (`domain_events`) los consumirá para actualizar los pases.
- Tabla futura `card_passes(card_id, channel['apple'|'google'], serial, auth_token, last_pushed_at)`.
- La tarjeta web, el QR y los pases leen la **misma** `loyalty_card`. Añadir un canal nuevo no toca el motor.
- El QR ya codifica la URL con el token público, el mismo identificador que llevaría el código de barras de un pase.

## 7. Diseño

- Panel neutro (blanco y grises, tipografía Inter) con estética Linear/Stripe. El **color del comercio** se inyecta con `--brand` en su panel.
- Tarjeta del cliente en tonos rosa empolvado, negro y blanco para Beauty Club, con tipografía serif (Cormorant) para un acabado premium.
- Mobile-first en `/join`, `/card` y `/scan` (el empleado suele usar el celular). Sidebar plegable en móvil.

## 8. Cómo ejecutar

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # Node local instalado en la Etapa 1
npm run dev                                  # http://localhost:3000
```

## 9. Próximas etapas (pendientes de aprobación)

- **Etapa 2** ✅: migraciones, Auth (contraseña + enlace por correo, solo por invitación), RLS, funciones RPC, capa `lib/data` y 60 pruebas de seguridad.
- **Etapa 3** ✅: registro real, QR de inscripción descargable, creación de tarjetas en el servidor, escáner con cámara (jsQR), registro de visitas y tarjeta que se actualiza sola.
- **Etapa 4**: recompensas, canjes, vencimientos (cron), historial, estadísticas con vistas SQL y exportación.
- **Etapa 5**: pruebas (unitarias del motor, e2e con Playwright), endurecimiento y piloto.

## 10. Decisiones abiertas

- Dominio definitivo de la plataforma. El nombre es "Lazo" (`src/lib/config.ts`); falta verificar la marca en la SIC.
- País por defecto del teléfono (configurado en +57 Colombia) y moneda de los planes (COP).
- ¿Verificar el teléfono con OTP al inscribirse? Mejora la calidad de los datos, pero añade fricción y coste de SMS.
