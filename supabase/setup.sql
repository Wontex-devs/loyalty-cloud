-- Generado por npm run db:bundle. No editar: cambia las migraciones y vuelve a generarlo.
-- Incluye: 20261101000001_schema.sql, 20261101000002_rls.sql, 20261101000003_functions.sql, 20261101000004_reference_data.sql, 20261101000005_public_business.sql, 20261101000006_business_stats.sql, 20261101000007_pilot.sql, 20261101000008_customer_experience.sql, 20261101000009_promotions_birthdays.sql, 20261101000010_plans_locations.sql
begin;

-- >>> 20261101000001_schema.sql
-- =====================================================================
-- Etapa 2 · Esquema multiempresa de la plataforma de fidelización
-- Cada tabla operativa lleva business_id. Las claves foráneas compuestas
-- (id, business_id) impiden mezclar registros de comercios distintos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------- Tipos ----------
create type public.platform_role  as enum ('superadmin', 'user');
create type public.business_role  as enum ('owner', 'admin', 'staff');
create type public.business_status as enum ('active', 'trial', 'suspended');
create type public.card_status    as enum ('active', 'reward_available', 'blocked');
create type public.reward_status  as enum ('available', 'redeemed', 'expired', 'void');
create type public.visit_kind     as enum ('visit', 'reversal');

-- ---------- Utilidades privadas ----------
-- Token público de tarjeta: 16 bytes aleatorios (128 bits) en base64url, 22 caracteres.
create function private.generate_public_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
$$;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bloquea UPDATE/DELETE en tablas de historial. Única excepción: anonimizar la
-- columna de actor (argumento del trigger) cuando se elimina un usuario (ON DELETE SET NULL).
create function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
begin
  if tg_op = 'UPDATE' and actor_col is not null
     and (to_jsonb(new) ->> actor_col) is null
     and (to_jsonb(new) - actor_col) = (to_jsonb(old) - actor_col) then
    return new;
  end if;
  raise exception 'IMMUTABLE_LEDGER: % no admite %', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

-- ---------- Plataforma ----------
create table public.plans (
  id             text primary key,
  name           text not null,
  price_monthly  integer not null check (price_monthly >= 0),
  currency       text not null default 'COP',
  max_customers  integer check (max_customers > 0),
  max_staff      integer check (max_staff > 0),
  max_programs   integer not null default 1 check (max_programs > 0),
  features       text[] not null default '{}',
  created_at     timestamptz not null default now()
);

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  name        text not null check (length(trim(name)) between 2 and 80),
  category    text not null,
  city        text not null,
  status      public.business_status not null default 'trial',
  plan_id     text not null references public.plans (id),
  branding    jsonb not null default '{}'::jsonb,
  timezone    text not null default 'America/Bogota',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function private.touch_updated_at();

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  email          text not null,
  platform_role  public.platform_role not null default 'user',
  created_at     timestamptz not null default now()
);

create table public.business_memberships (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  role         public.business_role not null,
  can_redeem   boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (business_id, profile_id)
);
-- Un único propietario por comercio.
create unique index business_memberships_one_owner
  on public.business_memberships (business_id) where role = 'owner';
create index business_memberships_profile_idx on public.business_memberships (profile_id);

-- ---------- Programa ----------
create table public.loyalty_programs (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references public.businesses (id) on delete cascade,
  name                        text not null check (length(trim(name)) between 2 and 60),
  description                 text not null default '',
  stamps_required             integer not null check (stamps_required between 2 and 30),
  reward_name                 text not null check (length(trim(reward_name)) between 2 and 80),
  reward_description          text not null default '',
  min_minutes_between_visits  integer not null default 60 check (min_minutes_between_visits between 0 and 1440),
  reward_expiry_days          integer check (reward_expiry_days between 1 and 365),
  terms                       text not null default '',
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (id, business_id)
);
create index loyalty_programs_business_idx on public.loyalty_programs (business_id);
create trigger loyalty_programs_updated_at before update on public.loyalty_programs
  for each row execute function private.touch_updated_at();

-- ---------- Clientes y tarjetas ----------
create table public.customers (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  full_name             text not null check (length(trim(full_name)) between 2 and 80),
  phone_e164            text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email                 text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  terms_accepted_at     timestamptz not null,
  marketing_consent     boolean not null default false,
  marketing_consent_at  timestamptz,
  created_at            timestamptz not null default now(),
  unique (business_id, phone_e164),   -- protección contra registros duplicados
  unique (id, business_id),
  check (marketing_consent = (marketing_consent_at is not null))
);

create table public.loyalty_cards (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  program_id      uuid not null,
  customer_id     uuid not null,
  public_token    text not null unique default private.generate_public_token()
                    check (public_token ~ '^[A-Za-z0-9_-]{22,}$'),
  status          public.card_status not null default 'active',
  current_stamps  integer not null default 0 check (current_stamps >= 0),
  total_visits    integer not null default 0 check (total_visits >= 0),
  last_visit_at   timestamptz,
  created_at      timestamptz not null default now(),
  unique (program_id, customer_id),
  unique (id, business_id),
  foreign key (program_id, business_id) references public.loyalty_programs (id, business_id) on delete cascade,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index loyalty_cards_business_idx on public.loyalty_cards (business_id);

-- ---------- Ledger de visitas (solo inserción) ----------
create table public.visits (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null,
  card_id            uuid not null,
  kind               public.visit_kind not null,
  delta              smallint not null,
  reverses_visit_id  uuid unique references public.visits (id),
  reason             text,
  staff_id           uuid references public.profiles (id) on delete set null,
  idempotency_key    text not null check (length(idempotency_key) between 8 and 100),
  created_at         timestamptz not null default now(),
  unique (business_id, idempotency_key),   -- evita el doble registro
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade,
  check ((kind = 'visit' and delta = 1 and reverses_visit_id is null)
      or (kind = 'reversal' and delta = -1 and reverses_visit_id is not null and length(trim(reason)) >= 5))
);
create index visits_card_idx on public.visits (card_id, created_at desc);
create index visits_business_created_idx on public.visits (business_id, created_at desc);
create trigger visits_immutable before update or delete on public.visits
  for each row execute function private.forbid_mutation('staff_id');

-- ---------- Recompensas y canjes ----------
create table public.rewards (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null,
  card_id          uuid not null,
  program_id       uuid not null,
  source_visit_id  uuid unique references public.visits (id),
  name             text not null,
  status           public.reward_status not null default 'available',
  earned_at        timestamptz not null default now(),
  expires_at       timestamptz,
  status_changed_at timestamptz,
  unique (id, business_id),
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade,
  foreign key (program_id, business_id) references public.loyalty_programs (id, business_id) on delete cascade
);
create index rewards_card_idx on public.rewards (card_id) where status = 'available';

create table public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  reward_id    uuid not null unique,   -- imposible canjear dos veces
  card_id      uuid not null,
  staff_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (reward_id, business_id) references public.rewards (id, business_id) on delete cascade,
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade
);
create trigger redemptions_immutable before update or delete on public.redemptions
  for each row execute function private.forbid_mutation('staff_id');

-- ---------- Auditoría ----------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  business_id  uuid references public.businesses (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  entity       text not null,
  entity_id    text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.forbid_mutation('actor_id');

create function private.audit(p_business uuid, p_action text, p_entity text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata)
  values (p_business, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- ---------- Campañas (futuro, sin lógica) ----------
create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  status       text not null default 'draft' check (status in ('draft')),
  created_at   timestamptz not null default now()
);

-- ---------- Perfil automático al crear un usuario de Auth ----------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- >>> 20261101000002_rls.sql
-- =====================================================================
-- Etapa 2 · Row Level Security
-- Principios:
--  * Sin políticas para `anon`: el público solo accede mediante RPC acotadas.
--  * Lectura de datos operativos: miembros activos del comercio.
--  * El superadmin ve comercios, planes, usuarios y agregados, pero NO los
--    datos personales de los clientes finales (customers/cards/visits).
--  * Visitas, recompensas, canjes y tarjetas no se escriben directamente:
--    solo mediante funciones transaccionales (ver 0003_functions.sql).
-- =====================================================================

-- ---------- Funciones de autorización (SECURITY DEFINER evita recursión en RLS) ----------
create function private.is_superadmin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'superadmin'
  );
$$;

create function private.is_member(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships
    where business_id = p_business and profile_id = auth.uid() and active
  );
$$;

create function private.has_role(p_business uuid, p_roles public.business_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships
    where business_id = p_business and profile_id = auth.uid() and active and role = any (p_roles)
  );
$$;

create function private.can_redeem(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships
    where business_id = p_business and profile_id = auth.uid() and active
      and (role in ('owner', 'admin') or can_redeem)
  );
$$;

create function private.shares_business(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships mine
    join public.business_memberships theirs on theirs.business_id = mine.business_id
    where mine.profile_id = auth.uid() and mine.active and theirs.profile_id = p_profile
  );
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function
  private.is_superadmin(),
  private.is_member(uuid),
  private.has_role(uuid, public.business_role[]),
  private.can_redeem(uuid),
  private.shares_business(uuid)
to authenticated;

-- ---------- Activar RLS en todas las tablas ----------
alter table public.plans                enable row level security;
alter table public.businesses           enable row level security;
alter table public.profiles             enable row level security;
alter table public.business_memberships enable row level security;
alter table public.loyalty_programs     enable row level security;
alter table public.customers            enable row level security;
alter table public.loyalty_cards        enable row level security;
alter table public.visits               enable row level security;
alter table public.rewards              enable row level security;
alter table public.redemptions          enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.campaigns            enable row level security;

-- Privilegios base: anon no toca tablas; authenticated depende de las políticas.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.business_memberships to authenticated;
grant insert, update on public.loyalty_programs to authenticated;
grant update (full_name, email) on public.customers to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert, update, delete on public.campaigns to authenticated;
grant insert, update on public.plans to authenticated;
-- service_role (solo servidor: semilla e invitaciones) necesita privilegios explícitos
-- porque el proyecto no expone tablas automáticamente.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- plans ----------
create policy plans_read on public.plans for select to authenticated using (true);
create policy plans_write on public.plans for insert to authenticated with check (private.is_superadmin());
create policy plans_update on public.plans for update to authenticated
  using (private.is_superadmin()) with check (private.is_superadmin());

-- ---------- businesses (escritura solo vía RPC) ----------
create policy businesses_read on public.businesses for select to authenticated
  using (private.is_member(id) or private.is_superadmin());

-- ---------- profiles ----------
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_superadmin() or private.shares_business(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- business_memberships ----------
create policy memberships_read on public.business_memberships for select to authenticated
  using (profile_id = auth.uid() or private.is_member(business_id) or private.is_superadmin());

-- Owner/admin gestionan empleados, pero nunca crean ni modifican al propietario.
create policy memberships_insert on public.business_memberships for insert to authenticated
  with check (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner')
  );
create policy memberships_update on public.business_memberships for update to authenticated
  using (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner' and profile_id <> auth.uid())
  )
  with check (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner')
  );
create policy memberships_delete on public.business_memberships for delete to authenticated
  using (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner' and profile_id <> auth.uid())
  );

-- ---------- loyalty_programs ----------
create policy programs_read on public.loyalty_programs for select to authenticated
  using (private.is_member(business_id) or private.is_superadmin());
create policy programs_insert on public.loyalty_programs for insert to authenticated
  with check (private.has_role(business_id, '{owner,admin}') or private.is_superadmin());
create policy programs_update on public.loyalty_programs for update to authenticated
  using (private.has_role(business_id, '{owner,admin}') or private.is_superadmin())
  with check (private.has_role(business_id, '{owner,admin}') or private.is_superadmin());

-- ---------- customers (datos personales: solo el comercio) ----------
create policy customers_read on public.customers for select to authenticated
  using (private.is_member(business_id));
create policy customers_update on public.customers for update to authenticated
  using (private.has_role(business_id, '{owner,admin}'))
  with check (private.has_role(business_id, '{owner,admin}'));

-- ---------- loyalty_cards / visits / rewards / redemptions (solo lectura) ----------
create policy cards_read on public.loyalty_cards for select to authenticated
  using (private.is_member(business_id));
create policy visits_read on public.visits for select to authenticated
  using (private.is_member(business_id));
create policy rewards_read on public.rewards for select to authenticated
  using (private.is_member(business_id));
create policy redemptions_read on public.redemptions for select to authenticated
  using (private.is_member(business_id));

-- ---------- audit_logs ----------
create policy audit_read on public.audit_logs for select to authenticated
  using (
    (business_id is not null and private.has_role(business_id, '{owner,admin}'))
    or private.is_superadmin()
  );

-- ---------- campaigns (futuro) ----------
create policy campaigns_read on public.campaigns for select to authenticated
  using (private.is_member(business_id));
create policy campaigns_write on public.campaigns for all to authenticated
  using (private.has_role(business_id, '{owner,admin}'))
  with check (private.has_role(business_id, '{owner,admin}'));

-- >>> 20261101000003_functions.sql
-- =====================================================================
-- Etapa 2 · Funciones RPC transaccionales
-- Todas son SECURITY DEFINER con search_path vacío y comprueban permisos
-- explícitamente. Los errores de negocio se lanzan con el código como
-- mensaje (p. ej. 'TOO_SOON') para que la app los traduzca.
-- =====================================================================

-- ---------- Público: inscripción (QR general del comercio) ----------
create function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean
)
returns table (public_token text, existing boolean)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_program  public.loyalty_programs;
  v_customer public.customers;
  v_card     public.loyalty_cards;
begin
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED';
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found or v_business.status = 'suspended' then
    raise exception 'BUSINESS_UNAVAILABLE';
  end if;

  select * into v_program from public.loyalty_programs
  where business_id = v_business.id and active
  order by created_at limit 1;
  if not found then
    raise exception 'PROGRAM_INACTIVE';
  end if;

  -- ¿Ya existe? Se devuelve su tarjeta sin modificar sus datos.
  select * into v_customer from public.customers
  where business_id = v_business.id and phone_e164 = p_phone_e164;

  if found then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id)
  values (v_business.id, v_program.id, v_customer.id)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false)));
  return query select v_card.public_token, false;
end;
$$;

-- ---------- Público: vista mínima de la tarjeta por token ----------
-- Nunca devuelve teléfono, correo ni IDs internos de otras entidades.
create function public.get_public_card(p_token text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'token', c.public_token,
    'status', c.status,
    'current_stamps', c.current_stamps,
    'total_visits', c.total_visits,
    'member_since', cu.created_at,
    'customer_name', cu.full_name,
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'branding', b.branding),
    'program', jsonb_build_object('name', p.name, 'stamps_required', p.stamps_required,
                                  'reward_name', p.reward_name, 'terms', p.terms),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'earned_at', r.earned_at, 'expires_at', r.expires_at)
                       order by r.earned_at)
      from public.rewards r
      where r.card_id = c.id and r.status = 'available'
        and (r.expires_at is null or r.expires_at > now())
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('kind', v.kind, 'delta', v.delta, 'created_at', v.created_at)
                       order by v.created_at desc)
      from (select * from public.visits where card_id = c.id order by created_at desc limit 5) v
    ), '[]'::jsonb)
  )
  from public.loyalty_cards c
  join public.customers cu on cu.id = c.customer_id
  join public.businesses b on b.id = c.business_id
  join public.loyalty_programs p on p.id = c.program_id
  where c.public_token = p_token
    and b.status <> 'suspended';
$$;

-- ---------- Registrar visita ----------
create function public.register_visit(p_card_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_card     public.loyalty_cards;
  v_program  public.loyalty_programs;
  v_status   public.business_status;
  v_visit_id uuid;
  v_reward_id uuid;
  v_stamps   integer;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_card.business_id) then raise exception 'FORBIDDEN'; end if;

  select status into v_status from public.businesses where id = v_card.business_id;
  if v_status = 'suspended' then raise exception 'BUSINESS_SUSPENDED'; end if;
  if v_card.status = 'blocked' then raise exception 'CARD_BLOCKED'; end if;

  if exists (select 1 from public.visits
             where business_id = v_card.business_id and idempotency_key = p_idempotency_key) then
    raise exception 'DUPLICATE_REQUEST';
  end if;

  select * into v_program from public.loyalty_programs where id = v_card.program_id;
  if not v_program.active then raise exception 'PROGRAM_INACTIVE'; end if;

  if v_card.last_visit_at is not null and v_program.min_minutes_between_visits > 0
     and v_card.last_visit_at > now() - make_interval(mins => v_program.min_minutes_between_visits) then
    raise exception 'TOO_SOON';
  end if;

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key)
  values (v_card.business_id, v_card.id, 'visit', 1, auth.uid(), p_idempotency_key)
  returning id into v_visit_id;

  v_stamps := v_card.current_stamps + 1;
  if v_stamps >= v_program.stamps_required then
    v_stamps := 0;
    insert into public.rewards (business_id, card_id, program_id, source_visit_id, name, expires_at)
    values (v_card.business_id, v_card.id, v_program.id, v_visit_id, v_program.reward_name,
            case when v_program.reward_expiry_days is not null
                 then now() + make_interval(days => v_program.reward_expiry_days) end)
    returning id into v_reward_id;
  end if;

  update public.loyalty_cards
  set current_stamps = v_stamps,
      total_visits   = total_visits + 1,
      last_visit_at  = now(),
      status         = case when v_reward_id is not null then 'reward_available' else status end
  where id = v_card.id;

  perform private.audit(v_card.business_id, 'visit.created', 'visit', v_visit_id::text,
                        jsonb_build_object('card_id', v_card.id));
  if v_reward_id is not null then
    perform private.audit(v_card.business_id, 'reward.earned', 'reward', v_reward_id::text,
                          jsonb_build_object('card_id', v_card.id));
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'reward_id', v_reward_id, 'current_stamps', v_stamps);
end;
$$;

-- ---------- Revertir visita (corrección auditada, sin borrar) ----------
create function public.reverse_visit(p_visit_id uuid, p_reason text)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_visit    public.visits;
  v_card     public.loyalty_cards;
  v_program  public.loyalty_programs;
  v_reward   public.rewards;
  v_reversal uuid;
  v_stamps   integer;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_visit from public.visits where id = p_visit_id and kind = 'visit';
  if not found then raise exception 'VISIT_NOT_FOUND'; end if;
  if not private.has_role(v_visit.business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;

  select * into v_card from public.loyalty_cards where id = v_visit.card_id for update;
  if exists (select 1 from public.visits where reverses_visit_id = v_visit.id) then
    raise exception 'ALREADY_REVERSED';
  end if;

  select * into v_program from public.loyalty_programs where id = v_card.program_id;
  select * into v_reward from public.rewards where source_visit_id = v_visit.id for update;

  if v_reward.id is not null then
    -- La visita completó un ciclo: se anula la recompensa si aún no se canjeó.
    if v_reward.status = 'redeemed' then raise exception 'REWARD_ALREADY_REDEEMED'; end if;
    update public.rewards set status = 'void', status_changed_at = now() where id = v_reward.id;
    v_stamps := v_program.stamps_required - 1;
  else
    v_stamps := greatest(v_card.current_stamps - 1, 0);
  end if;

  insert into public.visits (business_id, card_id, kind, delta, reverses_visit_id, reason, staff_id, idempotency_key)
  values (v_visit.business_id, v_visit.card_id, 'reversal', -1, v_visit.id, trim(p_reason), auth.uid(),
          'reverse:' || v_visit.id::text)
  returning id into v_reversal;

  update public.loyalty_cards
  set current_stamps = v_stamps,
      total_visits   = greatest(total_visits - 1, 0),
      status = case
        when status = 'blocked' then status
        when exists (select 1 from public.rewards r where r.card_id = v_card.id and r.status = 'available')
          then 'reward_available'::public.card_status
        else 'active'::public.card_status end
  where id = v_card.id;

  perform private.audit(v_visit.business_id, 'visit.reversed', 'visit', v_visit.id::text,
                        jsonb_build_object('reason', trim(p_reason), 'reversal_id', v_reversal,
                                           'voided_reward_id', v_reward.id));
  return jsonb_build_object('reversal_id', v_reversal, 'current_stamps', v_stamps);
end;
$$;

-- ---------- Canjear recompensa ----------
create function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_reward     public.rewards;
  v_redemption uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if not private.can_redeem(v_reward.business_id) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.businesses where id = v_reward.business_id and status = 'suspended') then
    raise exception 'BUSINESS_SUSPENDED';
  end if;
  if v_reward.status = 'redeemed' then raise exception 'ALREADY_REDEEMED'; end if;
  if v_reward.status <> 'available' then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then
    update public.rewards set status = 'expired', status_changed_at = now() where id = v_reward.id;
    raise exception 'REWARD_EXPIRED';
  end if;

  insert into public.redemptions (business_id, reward_id, card_id, staff_id)
  values (v_reward.business_id, v_reward.id, v_reward.card_id, auth.uid())
  returning id into v_redemption;

  update public.rewards set status = 'redeemed', status_changed_at = now() where id = v_reward.id;

  update public.loyalty_cards c
  set status = 'active'
  where c.id = v_reward.card_id and c.status = 'reward_available'
    and not exists (select 1 from public.rewards r where r.card_id = c.id and r.status = 'available');

  perform private.audit(v_reward.business_id, 'reward.redeemed', 'reward', v_reward.id::text,
                        jsonb_build_object('redemption_id', v_redemption, 'card_id', v_reward.card_id));
  return jsonb_build_object('redemption_id', v_redemption);
end;
$$;

-- ---------- Bloquear / activar tarjeta ----------
create function public.set_card_blocked(p_card_id uuid, p_blocked boolean)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_card public.loyalty_cards;
begin
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.has_role(v_card.business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;

  update public.loyalty_cards
  set status = case
    when p_blocked then 'blocked'::public.card_status
    when exists (select 1 from public.rewards r where r.card_id = v_card.id and r.status = 'available')
      then 'reward_available'::public.card_status
    else 'active'::public.card_status end
  where id = v_card.id;

  perform private.audit(v_card.business_id, case when p_blocked then 'card.blocked' else 'card.unblocked' end,
                        'loyalty_card', v_card.id::text);
end;
$$;

-- ---------- Comercio: perfil e identidad visual (owner/admin) ----------
create function public.update_business_profile(
  p_business_id uuid,
  p_name text,
  p_category text,
  p_city text,
  p_timezone text,
  p_branding jsonb
)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      if k not in ('logoText', 'logoUrl', 'primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        raise exception 'INVALID_BRANDING';
      end if;
      if k not in ('logoText', 'logoUrl') and (p_branding ->> k) !~ '^#[0-9a-fA-F]{6}$' then
        raise exception 'INVALID_BRANDING';
      end if;
    end loop;
  end if;

  update public.businesses
  set name     = coalesce(nullif(trim(p_name), ''), name),
      category = coalesce(nullif(trim(p_category), ''), category),
      city     = coalesce(nullif(trim(p_city), ''), city),
      timezone = coalesce(nullif(trim(p_timezone), ''), timezone),
      branding = case when p_branding is null then branding else branding || p_branding end
  where id = p_business_id;

  perform private.audit(p_business_id, 'business.updated', 'business', p_business_id::text,
                        jsonb_build_object('branding_changed', p_branding is not null));
end;
$$;

-- ---------- Plataforma (superadmin) ----------
create function public.create_business(
  p_name text,
  p_slug text,
  p_category text,
  p_city text,
  p_plan_id text,
  p_reward_name text default 'Recompensa',
  p_stamps_required integer default 9
)
returns uuid
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.businesses where slug = p_slug) then raise exception 'SLUG_TAKEN'; end if;

  insert into public.businesses (name, slug, category, city, plan_id, status, branding)
  values (trim(p_name), p_slug, p_category, p_city, p_plan_id, 'trial',
          jsonb_build_object('logoText', upper(left(trim(p_name), 2)), 'primary', '#111111',
                             'primaryForeground', '#FFFFFF', 'accent', '#D8A7A7',
                             'cardBackground', '#EBCFCB', 'cardForeground', '#1A1416'))
  returning id into v_id;

  insert into public.loyalty_programs (business_id, name, stamps_required, reward_name)
  values (v_id, trim(p_name), p_stamps_required, p_reward_name);

  perform private.audit(null, 'business.created', 'business', v_id::text, jsonb_build_object('slug', p_slug));
  return v_id;
end;
$$;

create function public.set_business_status(p_business_id uuid, p_status public.business_status, p_reason text default null)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  update public.businesses set status = p_status where id = p_business_id;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  perform private.audit(null, 'business.' || p_status::text, 'business', p_business_id::text,
                        jsonb_build_object('reason', p_reason));
end;
$$;

-- Agregados por comercio para el superadmin (sin datos personales).
create function public.platform_business_stats()
returns table (business_id uuid, customers bigint, visits_30d bigint, redemptions_30d bigint)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  return query
  select b.id,
         (select count(*) from public.customers c where c.business_id = b.id),
         (select count(*) from public.visits v where v.business_id = b.id and v.kind = 'visit'
            and v.created_at > now() - interval '30 days'),
         (select count(*) from public.redemptions r where r.business_id = b.id
            and r.created_at > now() - interval '30 days')
  from public.businesses b;
end;
$$;

-- ---------- Auditoría automática de cambios de configuración ----------
create function private.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.audit(
    coalesce(new.business_id, old.business_id),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('changed', (
        select coalesce(jsonb_agg(key), '[]'::jsonb) from jsonb_each(to_jsonb(new)) n
        where n.value is distinct from (to_jsonb(old) -> n.key) and n.key <> 'updated_at'))
      else '{}'::jsonb end
  );
  return coalesce(new, old);
end;
$$;

create trigger loyalty_programs_audit after insert or update on public.loyalty_programs
  for each row execute function private.audit_config_change();
create trigger business_memberships_audit after insert or update or delete on public.business_memberships
  for each row execute function private.audit_config_change();

-- ---------- Permisos de ejecución ----------
revoke all on function
  public.join_program(text, text, text, text, boolean, boolean),
  public.get_public_card(text),
  public.register_visit(uuid, text),
  public.reverse_visit(uuid, text),
  public.redeem_reward(uuid),
  public.set_card_blocked(uuid, boolean),
  public.update_business_profile(uuid, text, text, text, text, jsonb),
  public.create_business(text, text, text, text, text, text, integer),
  public.set_business_status(uuid, public.business_status, text),
  public.platform_business_stats()
from public, anon, authenticated;

grant execute on function public.join_program(text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.get_public_card(text) to anon, authenticated;
grant execute on function
  public.register_visit(uuid, text),
  public.reverse_visit(uuid, text),
  public.redeem_reward(uuid),
  public.set_card_blocked(uuid, boolean),
  public.update_business_profile(uuid, text, text, text, text, jsonb),
  public.create_business(text, text, text, text, text, text, integer),
  public.set_business_status(uuid, public.business_status, text),
  public.platform_business_stats()
to authenticated;

-- >>> 20261101000004_reference_data.sql
-- Planes iniciales de la plataforma (editables por el superadmin).
insert into public.plans (id, name, price_monthly, currency, max_customers, max_staff, max_programs, features) values
  ('plan_starter',  'Starter',  59000,  'COP', 300,  2,    1,  array['1 programa', 'Tarjeta web con QR', 'Hasta 300 clientes', '2 empleados']),
  ('plan_pro',      'Pro',      119000, 'COP', 2000, 10,   3,  array['3 programas', 'Marca blanca completa', 'Hasta 2.000 clientes', 'Estadísticas avanzadas']),
  ('plan_business', 'Business', 249000, 'COP', null, null, 10, array['Programas ilimitados', 'Clientes ilimitados', 'Multi-sede (próx.)', 'Soporte prioritario'])
on conflict (id) do nothing;

-- >>> 20261101000005_public_business.sql
-- =====================================================================
-- Etapa 3 · Vista pública mínima del comercio para la página de inscripción
-- (QR general). Solo identidad visual y reglas del programa: nada de clientes.
-- =====================================================================
create function public.get_public_business(p_slug text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'category', b.category,
    'branding', b.branding,
    'program', jsonb_build_object(
      'name', p.name,
      'description', p.description,
      'stamps_required', p.stamps_required,
      'reward_name', p.reward_name,
      'reward_description', p.reward_description,
      'terms', p.terms
    )
  )
  from public.businesses b
  join lateral (
    select * from public.loyalty_programs lp
    where lp.business_id = b.id and lp.active
    order by lp.created_at limit 1
  ) p on true
  where b.slug = p_slug and b.status <> 'suspended';
$$;

revoke all on function public.get_public_business(text) from public, anon, authenticated;
grant execute on function public.get_public_business(text) to anon, authenticated;

-- >>> 20261101000006_business_stats.sql
-- =====================================================================
-- Etapa 4 · Estadísticas del comercio calculadas en Postgres
-- El panel ya no depende de cuántas filas pueda descargar el navegador:
-- todos los agregados salen de aquí, en la zona horaria del comercio.
-- Solo propietario y administrador (permiso analytics.read).
-- =====================================================================
create function public.business_stats(p_business_id uuid, p_days integer)
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_tz       text;
  v_days     integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today    date;
  v_from     timestamptz;
  v_prev     timestamptz;
  v_required integer;
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;

  select timezone into v_tz from public.businesses where id = p_business_id;
  v_today := (now() at time zone v_tz)::date;
  v_from  := (v_today - (v_days - 1))::timestamp at time zone v_tz;
  v_prev  := (v_today - (2 * v_days - 1))::timestamp at time zone v_tz;

  select stamps_required into v_required from public.loyalty_programs
  where business_id = p_business_id and active order by created_at limit 1;
  v_required := coalesce(v_required, 1);

  return (
    with v as (
      -- Visitas netas: una visita revertida no cuenta.
      select vi.card_id, vi.staff_id, vi.created_at, vi.created_at at time zone v_tz as local_at
      from public.visits vi
      where vi.business_id = p_business_id and vi.kind = 'visit' and vi.created_at >= v_prev
        and not exists (select 1 from public.visits r where r.reverses_visit_id = vi.id)
    ),
    cur as (select * from v where created_at >= v_from),
    red as (
      select staff_id from public.redemptions
      where business_id = p_business_id and created_at >= v_from
    ),
    staff as (
      select staff_id, sum(vis)::int as visits, sum(rd)::int as redemptions
      from (select staff_id, 1 as vis, 0 as rd from cur
            union all
            select staff_id, 0, 1 from red) u
      group by staff_id
    )
    select jsonb_build_object(
      'days', v_days,
      'visits', (select count(*) from cur),
      'visits_prev', (select count(*) from v where created_at < v_from),
      'reversals', (select count(*) from public.visits
                    where business_id = p_business_id and kind = 'reversal' and created_at >= v_from),
      'new_customers', (select count(*) from public.customers
                        where business_id = p_business_id and created_at >= v_from),
      'total_customers', (select count(*) from public.customers where business_id = p_business_id),
      'active_customers', (select count(distinct card_id) from cur),
      'returning_customers', (select count(*) from (select 1 from cur group by card_id having count(*) >= 2) x),
      'rewards_earned', (select count(*) from public.rewards
                         where business_id = p_business_id and status <> 'void' and earned_at >= v_from),
      'redemptions', (select count(*) from red),
      'rewards_available', (select count(*) from public.rewards
                            where business_id = p_business_id and status = 'available'
                              and (expires_at is null or expires_at > now())),
      'marketing_consent', (select count(*) from public.customers
                            where business_id = p_business_id and marketing_consent),
      'daily', (select jsonb_agg(jsonb_build_object(
                         'date', v_today - (v_days - 1) + i,
                         'value', (select count(*) from cur where local_at::date = v_today - (v_days - 1) + i))
                       order by i)
                from generate_series(0, v_days - 1) i),
      'weekday', (select jsonb_agg((select count(*) from cur where extract(isodow from local_at) = d) order by d)
                  from generate_series(1, 7) d),
      'hourly', (select jsonb_agg((select count(*) from cur where extract(hour from local_at) = h) order by h)
                 from generate_series(0, 23) h),
      'by_staff', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', coalesce(nullif(p.full_name, ''), p.email, 'Usuario eliminado'),
                 'visits', s.visits, 'redemptions', s.redemptions)
               order by s.visits desc, s.redemptions desc)
        from staff s left join public.profiles p on p.id = s.staff_id
      ), '[]'::jsonb),
      'stamp_distribution', (
        select jsonb_agg((select count(*) from public.loyalty_cards c
                          where c.business_id = p_business_id and c.status <> 'blocked'
                            and least(c.current_stamps, v_required - 1) = s) order by s)
        from generate_series(0, v_required - 1) s)
    )
  );
end;
$$;

-- ---------- Canje: tarjeta bloqueada y vencimiento ----------
-- Una tarjeta bloqueada tampoco admite canjes (antes solo se frenaban las visitas).
-- La versión anterior marcaba 'expired' justo antes de lanzar el error, pero el
-- error deshace la transacción y ese cambio nunca se guardaba. Una recompensa
-- con expires_at pasado se trata como vencida en todas las lecturas.
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_reward     public.rewards;
  v_redemption uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if not private.can_redeem(v_reward.business_id) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.businesses where id = v_reward.business_id and status = 'suspended') then
    raise exception 'BUSINESS_SUSPENDED';
  end if;
  if v_reward.status = 'redeemed' then raise exception 'ALREADY_REDEEMED'; end if;
  if v_reward.status <> 'available' then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then raise exception 'REWARD_EXPIRED'; end if;
  if exists (select 1 from public.loyalty_cards where id = v_reward.card_id and status = 'blocked') then
    raise exception 'CARD_BLOCKED';
  end if;

  insert into public.redemptions (business_id, reward_id, card_id, staff_id)
  values (v_reward.business_id, v_reward.id, v_reward.card_id, auth.uid())
  returning id into v_redemption;

  update public.rewards set status = 'redeemed', status_changed_at = now() where id = v_reward.id;

  update public.loyalty_cards c
  set status = 'active'
  where c.id = v_reward.card_id and c.status = 'reward_available'
    and not exists (select 1 from public.rewards r where r.card_id = c.id and r.status = 'available'
                    and (r.expires_at is null or r.expires_at > now()));

  perform private.audit(v_reward.business_id, 'reward.redeemed', 'reward', v_reward.id::text,
                        jsonb_build_object('redemption_id', v_redemption, 'card_id', v_reward.card_id));
  return jsonb_build_object('redemption_id', v_redemption);
end;
$$;

revoke all on function public.business_stats(uuid, integer) from public, anon, authenticated;
grant execute on function public.business_stats(uuid, integer) to authenticated;

-- ---------- Exportación de clientes: queda en la auditoría ----------
-- La lectura la hace la app con RLS; esto solo deja constancia de quién exportó datos personales.
create function public.log_customers_export(p_business_id uuid, p_count integer)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_business_id, '{owner}') then raise exception 'FORBIDDEN'; end if;
  perform private.audit(p_business_id, 'customers.exported', 'business', p_business_id::text,
                        jsonb_build_object('rows', greatest(coalesce(p_count, 0), 0)));
end;
$$;

revoke all on function public.log_customers_export(uuid, integer) from public, anon, authenticated;
grant execute on function public.log_customers_export(uuid, integer) to authenticated;

-- >>> 20261101000007_pilot.sql
-- =====================================================================
-- Etapa 5 · Preparación del piloto
-- - Datos del responsable del tratamiento (Ley 1581 de 2012) en el comercio.
-- - Configuración del comercio editable con validación (incluida la zona horaria).
-- - Freno de inscripciones masivas en la propia base de datos.
-- =====================================================================
alter table public.businesses
  add column legal_name    text check (legal_name is null or length(trim(legal_name)) between 2 and 120),
  add column tax_id        text check (tax_id is null or length(trim(tax_id)) between 3 and 30),
  add column contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column contact_phone text check (contact_phone is null or length(trim(contact_phone)) between 7 and 30),
  add column address       text check (address is null or length(trim(address)) between 5 and 200);

-- ---------- Configuración del comercio (owner/admin) ----------
create function public.update_business_settings(
  p_business_id   uuid,
  p_name          text,
  p_category      text,
  p_city          text,
  p_timezone      text,
  p_legal_name    text,
  p_tax_id        text,
  p_contact_email text,
  p_contact_phone text,
  p_address       text
)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  -- Una zona horaria inválida rompería las estadísticas.
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE';
  end if;

  update public.businesses
  set name          = coalesce(nullif(trim(p_name), ''), name),
      category      = coalesce(nullif(trim(p_category), ''), category),
      city          = coalesce(nullif(trim(p_city), ''), city),
      timezone      = p_timezone,
      legal_name    = nullif(trim(coalesce(p_legal_name, '')), ''),
      tax_id        = nullif(trim(coalesce(p_tax_id, '')), ''),
      contact_email = nullif(lower(trim(coalesce(p_contact_email, ''))), ''),
      contact_phone = nullif(trim(coalesce(p_contact_phone, '')), ''),
      address       = nullif(trim(coalesce(p_address, '')), '')
  where id = p_business_id;

  perform private.audit(p_business_id, 'business.updated', 'business', p_business_id::text,
                        jsonb_build_object('settings', true));
end;
$$;

revoke all on function public.update_business_settings(uuid, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_business_settings(uuid, text, text, text, text, text, text, text, text, text)
  to authenticated;

-- ---------- Ficha pública: añade ciudad y responsable del tratamiento ----------
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'category', b.category,
    'city', b.city,
    -- Responsable del tratamiento de datos: información que debe ser pública.
    'legal', jsonb_build_object(
      'legal_name', b.legal_name,
      'tax_id', b.tax_id,
      'contact_email', b.contact_email,
      'contact_phone', b.contact_phone,
      'address', b.address
    ),
    'branding', b.branding,
    'program', jsonb_build_object(
      'name', p.name,
      'description', p.description,
      'stamps_required', p.stamps_required,
      'reward_name', p.reward_name,
      'reward_description', p.reward_description,
      'reward_expiry_days', p.reward_expiry_days,
      'terms', p.terms
    )
  )
  from public.businesses b
  join lateral (
    select * from public.loyalty_programs lp
    where lp.business_id = b.id and lp.active
    order by lp.created_at limit 1
  ) p on true
  where b.slug = p_slug and b.status <> 'suspended';
$$;

-- ---------- Inscripción con freno por comercio ----------
create or replace function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean
)
returns table (public_token text, existing boolean)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_program  public.loyalty_programs;
  v_customer public.customers;
  v_card     public.loyalty_cards;
begin
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED';
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found or v_business.status = 'suspended' then
    raise exception 'BUSINESS_UNAVAILABLE';
  end if;

  select * into v_program from public.loyalty_programs
  where business_id = v_business.id and active
  order by created_at limit 1;
  if not found then
    raise exception 'PROGRAM_INACTIVE';
  end if;

  -- ¿Ya existe? Se devuelve su tarjeta sin modificar sus datos.
  select * into v_customer from public.customers
  where business_id = v_business.id and phone_e164 = p_phone_e164;

  if found then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    -- Freno en la base de datos (la app añade otro por IP): protege también a quien
    -- llame a la API pública directamente con la clave anónima.
    if (select count(*) from public.customers
        where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 60 then
      raise exception 'RATE_LIMITED';
    end if;

    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id)
  values (v_business.id, v_program.id, v_customer.id)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false)));
  return query select v_card.public_token, false;
end;
$$;

-- >>> 20261101000008_customer_experience.sql
-- =====================================================================
-- Etapa 6 · Experiencia de la clienta
-- - Recuperación segura: un celular ya inscrito solo devuelve su tarjeta si el
--   nombre coincide (sin tildes, mayúsculas ni espacios de más).
-- - Sellos de bienvenida: la tarjeta nueva empieza con N sellos de regalo.
-- =====================================================================
create function private.normalize_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(trim(coalesce(p, ''))), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '\s+', ' ', 'g');
$$;
revoke all on function private.normalize_name(text) from public;

alter table public.loyalty_programs
  add column welcome_stamps integer not null default 0 check (welcome_stamps between 0 and 5);
alter table public.loyalty_programs
  add constraint loyalty_programs_welcome_lt_required check (welcome_stamps < stamps_required);

-- ---------- Ficha pública: añade los sellos de bienvenida ----------
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'category', b.category,
    'city', b.city,
    'legal', jsonb_build_object(
      'legal_name', b.legal_name,
      'tax_id', b.tax_id,
      'contact_email', b.contact_email,
      'contact_phone', b.contact_phone,
      'address', b.address
    ),
    'branding', b.branding,
    'program', jsonb_build_object(
      'name', p.name,
      'description', p.description,
      'stamps_required', p.stamps_required,
      'reward_name', p.reward_name,
      'reward_description', p.reward_description,
      'reward_expiry_days', p.reward_expiry_days,
      'welcome_stamps', p.welcome_stamps,
      'terms', p.terms
    )
  )
  from public.businesses b
  join lateral (
    select * from public.loyalty_programs lp
    where lp.business_id = b.id and lp.active
    order by lp.created_at limit 1
  ) p on true
  where b.slug = p_slug and b.status <> 'suspended';
$$;

-- ---------- Inscripción: recuperación segura y sellos de bienvenida ----------
create or replace function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean
)
returns table (public_token text, existing boolean)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_program  public.loyalty_programs;
  v_customer public.customers;
  v_card     public.loyalty_cards;
begin
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED';
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found or v_business.status = 'suspended' then
    raise exception 'BUSINESS_UNAVAILABLE';
  end if;

  select * into v_program from public.loyalty_programs
  where business_id = v_business.id and active
  order by created_at limit 1;
  if not found then
    raise exception 'PROGRAM_INACTIVE';
  end if;

  -- ¿Ya existe? Se devuelve su tarjeta sin modificar sus datos.
  select * into v_customer from public.customers
  where business_id = v_business.id and phone_e164 = p_phone_e164;

  if found then
    -- Recuperar la tarjeta exige el mismo nombre: con solo un número de celular
    -- nadie puede abrir la tarjeta (y ver el nombre) de otra persona.
    if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
      raise exception 'PHONE_REGISTERED';
    end if;
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    -- Freno en la base de datos (la app añade otro por IP): protege también a quien
    -- llame a la API pública directamente con la clave anónima.
    if (select count(*) from public.customers
        where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 60 then
      raise exception 'RATE_LIMITED';
    end if;

    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
      if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
        raise exception 'PHONE_REGISTERED';
      end if;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id, current_stamps)
  values (v_business.id, v_program.id, v_customer.id, v_program.welcome_stamps)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false),
                                           'welcome_stamps', v_program.welcome_stamps));
  return query select v_card.public_token, false;
end;
$$;

-- >>> 20261101000009_promotions_birthdays.sql
-- =====================================================================
-- Etapa 7 · Promociones, cumpleaños y contactos por WhatsApp
-- - Promociones por fechas y días de la semana que suman sellos extra (doble sello).
-- - Regalo de cumpleaños en la primera visita del mes de cumpleaños.
-- - Registro de cada mensaje de WhatsApp que el equipo envía, uno a uno y solo a
--   clientas con consentimiento de marketing. No hay envíos masivos ni automáticos.
-- =====================================================================

-- ---------- Promociones ----------
create table public.promotions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 60),
  bonus_stamps  smallint not null check (bonus_stamps between 1 and 4),
  starts_on     date not null,
  ends_on       date not null,
  weekdays      smallint[] not null default '{1,2,3,4,5,6,7}'
                  check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 366),
  unique (id, business_id)
);
create index promotions_business_idx on public.promotions (business_id, ends_on);
create trigger promotions_updated_at before update on public.promotions
  for each row execute function private.touch_updated_at();
create trigger promotions_audit after insert or update on public.promotions
  for each row execute function private.audit_config_change();

alter table public.promotions enable row level security;
grant select, insert, update on public.promotions to authenticated;
grant all on public.promotions to service_role;
create policy promotions_read on public.promotions for select to authenticated
  using (private.is_member(business_id));
create policy promotions_insert on public.promotions for insert to authenticated
  with check (private.has_role(business_id, '{owner,admin}'));
create policy promotions_update on public.promotions for update to authenticated
  using (private.has_role(business_id, '{owner,admin}'))
  with check (private.has_role(business_id, '{owner,admin}'));

-- Promoción vigente hoy en la zona horaria del comercio (la de más sellos si hay varias).
create function private.active_promotion(p_business uuid)
returns public.promotions
language sql
stable security definer
set search_path = ''
as $$
  select p.* from public.promotions p
  join public.businesses b on b.id = p.business_id
  where p.business_id = p_business and p.active
    and (now() at time zone b.timezone)::date between p.starts_on and p.ends_on
    and extract(isodow from now() at time zone b.timezone)::smallint = any (p.weekdays)
  order by p.bonus_stamps desc, p.created_at
  limit 1;
$$;
revoke all on function private.active_promotion(uuid) from public;

alter table public.visits
  add column bonus_stamps smallint not null default 0
    check (bonus_stamps between 0 and 4 and (kind = 'visit' or bonus_stamps = 0)),
  add column promotion_id uuid references public.promotions (id);

-- ---------- Cumpleaños ----------
alter table public.customers
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day   smallint check (birth_day between 1 and 31),
  add constraint customers_birthday_pair check ((birth_month is null) = (birth_day is null));
alter table public.loyalty_programs
  add column birthday_reward text check (birthday_reward is null or length(trim(birthday_reward)) between 2 and 80);
alter table public.rewards
  add column kind text not null default 'cycle' check (kind in ('cycle', 'birthday')),
  add column birthday_year smallint,
  add constraint rewards_birthday_year check ((kind = 'birthday') = (birthday_year is not null)),
  add constraint rewards_one_birthday_per_year unique (card_id, birthday_year);
grant update (birth_month, birth_day) on public.customers to authenticated;

-- ---------- Contactos por WhatsApp (uno a uno) ----------
create table public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  customer_id  uuid not null,
  channel      text not null default 'whatsapp' check (channel in ('whatsapp')),
  segment      text not null check (length(segment) between 2 and 40),
  staff_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index customer_contacts_business_idx on public.customer_contacts (business_id, created_at desc);
create trigger customer_contacts_immutable before update or delete on public.customer_contacts
  for each row execute function private.forbid_mutation('staff_id');
alter table public.customer_contacts enable row level security;
grant select on public.customer_contacts to authenticated;
grant all on public.customer_contacts to service_role;
create policy customer_contacts_read on public.customer_contacts for select to authenticated
  using (private.has_role(business_id, '{owner,admin}'));

create function public.log_customer_contact(p_customer_id uuid, p_segment text)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not private.has_role(v_customer.business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if not v_customer.marketing_consent then raise exception 'NO_MARKETING_CONSENT'; end if;
  insert into public.customer_contacts (business_id, customer_id, segment, staff_id)
  values (v_customer.business_id, v_customer.id, left(trim(coalesce(p_segment, 'manual')), 40), auth.uid());
end;
$$;
revoke all on function public.log_customer_contact(uuid, text) from public, anon, authenticated;
grant execute on function public.log_customer_contact(uuid, text) to authenticated;

-- ---------- Tarjeta pública: promoción del día ----------
create or replace function public.get_public_card(p_token text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'token', c.public_token,
    'status', c.status,
    'current_stamps', c.current_stamps,
    'total_visits', c.total_visits,
    'member_since', cu.created_at,
    'customer_name', cu.full_name,
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'branding', b.branding),
    'program', jsonb_build_object('name', p.name, 'stamps_required', p.stamps_required,
                                  'reward_name', p.reward_name, 'terms', p.terms),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'kind', r.kind, 'earned_at', r.earned_at, 'expires_at', r.expires_at)
                       order by r.earned_at)
      from public.rewards r
      where r.card_id = c.id and r.status = 'available'
        and (r.expires_at is null or r.expires_at > now())
    ), '[]'::jsonb),
    'promotion', (select jsonb_build_object('name', pr.name, 'bonus_stamps', pr.bonus_stamps, 'ends_on', pr.ends_on)
                  from private.active_promotion(c.business_id) pr where pr.id is not null),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('kind', v.kind, 'delta', v.delta, 'bonus', v.bonus_stamps, 'created_at', v.created_at)
                       order by v.created_at desc)
      from (select * from public.visits where card_id = c.id order by created_at desc limit 5) v
    ), '[]'::jsonb)
  )
  from public.loyalty_cards c
  join public.customers cu on cu.id = c.customer_id
  join public.businesses b on b.id = c.business_id
  join public.loyalty_programs p on p.id = c.program_id
  where c.public_token = p_token
    and b.status <> 'suspended';
$$;

-- ---------- Registrar visita: promoción y cumpleaños ----------
create or replace function public.register_visit(p_card_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_card     public.loyalty_cards;
  v_program  public.loyalty_programs;
  v_status   public.business_status;
  v_visit_id uuid;
  v_reward_id uuid;
  v_stamps   integer;
  v_promo    public.promotions;
  v_bonus    integer := 0;
  v_tz       text;
  v_local    timestamp;
  v_customer public.customers;
  v_bday_id  uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_card.business_id) then raise exception 'FORBIDDEN'; end if;

  select status, timezone into v_status, v_tz from public.businesses where id = v_card.business_id;
  v_local := now() at time zone v_tz;
  if v_status = 'suspended' then raise exception 'BUSINESS_SUSPENDED'; end if;
  if v_card.status = 'blocked' then raise exception 'CARD_BLOCKED'; end if;

  if exists (select 1 from public.visits
             where business_id = v_card.business_id and idempotency_key = p_idempotency_key) then
    raise exception 'DUPLICATE_REQUEST';
  end if;

  select * into v_program from public.loyalty_programs where id = v_card.program_id;
  if not v_program.active then raise exception 'PROGRAM_INACTIVE'; end if;

  if v_card.last_visit_at is not null and v_program.min_minutes_between_visits > 0
     and v_card.last_visit_at > now() - make_interval(mins => v_program.min_minutes_between_visits) then
    raise exception 'TOO_SOON';
  end if;

  -- Promoción vigente hoy (p. ej. doble sello): suma sellos extra en la misma visita.
  select * into v_promo from private.active_promotion(v_card.business_id);
  v_bonus := coalesce(v_promo.bonus_stamps, 0);

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key, bonus_stamps, promotion_id)
  values (v_card.business_id, v_card.id, 'visit', 1, auth.uid(), p_idempotency_key, v_bonus, v_promo.id)
  returning id into v_visit_id;

  v_stamps := v_card.current_stamps + 1 + v_bonus;
  if v_stamps >= v_program.stamps_required then
    -- Los sellos que sobran pasan al siguiente ciclo (como máximo hasta quedar a uno de la meta).
    v_stamps := least(v_stamps - v_program.stamps_required, v_program.stamps_required - 1);
    insert into public.rewards (business_id, card_id, program_id, source_visit_id, name, expires_at)
    values (v_card.business_id, v_card.id, v_program.id, v_visit_id, v_program.reward_name,
            case when v_program.reward_expiry_days is not null
                 then now() + make_interval(days => v_program.reward_expiry_days) end)
    returning id into v_reward_id;
  end if;

  -- Regalo de cumpleaños: en la primera visita del mes de cumpleaños, una vez al año.
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_program.birthday_reward is not null and v_customer.birth_month = extract(month from v_local)::int then
    insert into public.rewards (business_id, card_id, program_id, name, kind, birthday_year, expires_at)
    values (v_card.business_id, v_card.id, v_program.id, v_program.birthday_reward, 'birthday',
            extract(year from v_local)::int, now() + interval '30 days')
    on conflict (card_id, birthday_year) do nothing
    returning id into v_bday_id;
  end if;

  update public.loyalty_cards
  set current_stamps = v_stamps,
      total_visits   = total_visits + 1,
      last_visit_at  = now(),
      status         = case when v_reward_id is not null or v_bday_id is not null then 'reward_available' else status end
  where id = v_card.id;

  perform private.audit(v_card.business_id, 'visit.created', 'visit', v_visit_id::text,
                        jsonb_build_object('card_id', v_card.id, 'bonus_stamps', v_bonus, 'promotion_id', v_promo.id));
  if v_bday_id is not null then
    perform private.audit(v_card.business_id, 'reward.birthday', 'reward', v_bday_id::text,
                          jsonb_build_object('card_id', v_card.id));
  end if;
  if v_reward_id is not null then
    perform private.audit(v_card.business_id, 'reward.earned', 'reward', v_reward_id::text,
                          jsonb_build_object('card_id', v_card.id));
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'reward_id', v_reward_id, 'current_stamps', v_stamps,
                            'bonus_stamps', v_bonus, 'birthday_reward_id', v_bday_id);
end;
$$;

-- ---------- Revertir visita: descuenta los sellos extra ----------
create or replace function public.reverse_visit(p_visit_id uuid, p_reason text)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_visit    public.visits;
  v_card     public.loyalty_cards;
  v_program  public.loyalty_programs;
  v_reward   public.rewards;
  v_reversal uuid;
  v_stamps   integer;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_visit from public.visits where id = p_visit_id and kind = 'visit';
  if not found then raise exception 'VISIT_NOT_FOUND'; end if;
  if not private.has_role(v_visit.business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;

  select * into v_card from public.loyalty_cards where id = v_visit.card_id for update;
  if exists (select 1 from public.visits where reverses_visit_id = v_visit.id) then
    raise exception 'ALREADY_REVERSED';
  end if;

  select * into v_program from public.loyalty_programs where id = v_card.program_id;
  select * into v_reward from public.rewards where source_visit_id = v_visit.id for update;

  if v_reward.id is not null then
    -- La visita completó un ciclo: se anula la recompensa si aún no se canjeó.
    if v_reward.status = 'redeemed' then raise exception 'REWARD_ALREADY_REDEEMED'; end if;
    update public.rewards set status = 'void', status_changed_at = now() where id = v_reward.id;
    v_stamps := least(greatest(v_card.current_stamps - 1 - v_visit.bonus_stamps + v_program.stamps_required, 0),
                      v_program.stamps_required - 1);
  else
    v_stamps := greatest(v_card.current_stamps - 1 - v_visit.bonus_stamps, 0);
  end if;

  insert into public.visits (business_id, card_id, kind, delta, reverses_visit_id, reason, staff_id, idempotency_key)
  values (v_visit.business_id, v_visit.card_id, 'reversal', -1, v_visit.id, trim(p_reason), auth.uid(),
          'reverse:' || v_visit.id::text)
  returning id into v_reversal;

  update public.loyalty_cards
  set current_stamps = v_stamps,
      total_visits   = greatest(total_visits - 1, 0),
      status = case
        when status = 'blocked' then status
        when exists (select 1 from public.rewards r where r.card_id = v_card.id and r.status = 'available')
          then 'reward_available'::public.card_status
        else 'active'::public.card_status end
  where id = v_card.id;

  perform private.audit(v_visit.business_id, 'visit.reversed', 'visit', v_visit.id::text,
                        jsonb_build_object('reason', trim(p_reason), 'reversal_id', v_reversal,
                                           'voided_reward_id', v_reward.id));
  return jsonb_build_object('reversal_id', v_reversal, 'current_stamps', v_stamps);
end;
$$;

-- ---------- Inscripción con cumpleaños opcional ----------
drop function public.join_program(text, text, text, text, boolean, boolean);
create function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean,
  p_birth_month integer default null,
  p_birth_day integer default null
)
returns table (public_token text, existing boolean)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_program  public.loyalty_programs;
  v_customer public.customers;
  v_card     public.loyalty_cards;
begin
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED';
  end if;
  -- Cumpleaños opcional (día y mes, sin año). 29 de febrero es válido.
  if (p_birth_month is null) <> (p_birth_day is null) then raise exception 'INVALID_BIRTHDAY'; end if;
  if p_birth_month is not null then
    begin
      perform make_date(2000, p_birth_month, p_birth_day);
    exception when others then
      raise exception 'INVALID_BIRTHDAY';
    end;
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found or v_business.status = 'suspended' then
    raise exception 'BUSINESS_UNAVAILABLE';
  end if;

  select * into v_program from public.loyalty_programs
  where business_id = v_business.id and active
  order by created_at limit 1;
  if not found then
    raise exception 'PROGRAM_INACTIVE';
  end if;

  -- ¿Ya existe? Se devuelve su tarjeta sin modificar sus datos.
  select * into v_customer from public.customers
  where business_id = v_business.id and phone_e164 = p_phone_e164;

  if found then
    -- Recuperar la tarjeta exige el mismo nombre: con solo un número de celular
    -- nadie puede abrir la tarjeta (y ver el nombre) de otra persona.
    if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
      raise exception 'PHONE_REGISTERED';
    end if;
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    -- Freno en la base de datos (la app añade otro por IP): protege también a quien
    -- llame a la API pública directamente con la clave anónima.
    if (select count(*) from public.customers
        where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 60 then
      raise exception 'RATE_LIMITED';
    end if;

    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at, birth_month, birth_day)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end, p_birth_month, p_birth_day)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
      if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
        raise exception 'PHONE_REGISTERED';
      end if;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id, current_stamps)
  values (v_business.id, v_program.id, v_customer.id, v_program.welcome_stamps)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false),
                                           'welcome_stamps', v_program.welcome_stamps));
  return query select v_card.public_token, false;
end;
$$;

revoke all on function public.join_program(text, text, text, text, boolean, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.join_program(text, text, text, text, boolean, boolean, integer, integer)
  to anon, authenticated;

-- >>> 20261101000010_plans_locations.sql
-- =====================================================================
-- Etapa 8 · Más comercios: límites de plan y sedes
-- - Los límites del plan (clientes, equipo, sedes) se aplican en la base de datos.
-- - Sedes por comercio: cada visita puede registrar en qué sede ocurrió.
-- - El superadmin puede cambiar el plan de un comercio (queda auditado).
-- =====================================================================

alter table public.plans add column max_locations integer check (max_locations is null or max_locations > 0);
update public.plans set max_locations = 1 where id = 'plan_starter';
update public.plans set max_locations = 3 where id = 'plan_pro';
update public.plans set max_locations = null where id = 'plan_business';
update public.plans set features = array['Programas ilimitados', 'Clientes ilimitados', 'Sedes ilimitadas', 'Soporte prioritario']
where id = 'plan_business';
update public.plans set features = array['3 programas', 'Marca blanca completa', 'Hasta 2.000 clientes', 'Hasta 3 sedes']
where id = 'plan_pro';

-- ---------- Sedes ----------
create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (length(trim(name)) between 2 and 60),
  address      text check (address is null or length(trim(address)) between 3 and 200),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, name)
);
create index locations_business_idx on public.locations (business_id);
create trigger locations_updated_at before update on public.locations
  for each row execute function private.touch_updated_at();
create trigger locations_audit after insert or update on public.locations
  for each row execute function private.audit_config_change();

alter table public.locations enable row level security;
grant select, insert, update on public.locations to authenticated;
grant all on public.locations to service_role;
create policy locations_read on public.locations for select to authenticated
  using (private.is_member(business_id));
create policy locations_insert on public.locations for insert to authenticated
  with check (private.has_role(business_id, '{owner,admin}'));
create policy locations_update on public.locations for update to authenticated
  using (private.has_role(business_id, '{owner,admin}'))
  with check (private.has_role(business_id, '{owner,admin}'));

alter table public.visits add column location_id uuid;
alter table public.visits add constraint visits_location_fk
  foreign key (location_id, business_id) references public.locations (id, business_id);

-- ---------- Límites del plan (equipo y sedes) ----------
create function private.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
begin
  select pl.* into v_plan from public.plans pl
  join public.businesses b on b.plan_id = pl.id where b.id = new.business_id;

  if tg_table_name = 'business_memberships' then
    -- Cuenta el equipo activo sin el propietario.
    if new.active and new.role <> 'owner' and v_plan.max_staff is not null
       and (tg_op = 'INSERT' or not old.active or old.role = 'owner')
       and (select count(*) from public.business_memberships
            where business_id = new.business_id and active and role <> 'owner' and id <> new.id) >= v_plan.max_staff then
      raise exception 'PLAN_LIMIT_STAFF';
    end if;
  elsif tg_table_name = 'locations' then
    if new.active and v_plan.max_locations is not null
       and (tg_op = 'INSERT' or not old.active)
       and (select count(*) from public.locations
            where business_id = new.business_id and active and id <> new.id) >= v_plan.max_locations then
      raise exception 'PLAN_LIMIT_LOCATIONS';
    end if;
  end if;
  return new;
end;
$$;
create trigger business_memberships_plan_limit before insert or update on public.business_memberships
  for each row execute function private.enforce_plan_limits();
create trigger locations_plan_limit before insert or update on public.locations
  for each row execute function private.enforce_plan_limits();

-- ---------- Plataforma: cambiar el plan de un comercio ----------
create function public.set_business_plan(p_business_id uuid, p_plan_id text)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.plans where id = p_plan_id) then raise exception 'PLAN_NOT_FOUND'; end if;
  select plan_id into v_old from public.businesses where id = p_business_id;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  update public.businesses set plan_id = p_plan_id where id = p_business_id;
  perform private.audit(p_business_id, 'business.plan_changed', 'business', p_business_id::text,
                        jsonb_build_object('from', v_old, 'to', p_plan_id));
end;
$$;
revoke all on function public.set_business_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.set_business_plan(uuid, text) to authenticated;

-- ---------- Inscripción: cupo de clientes del plan ----------
create or replace function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean,
  p_birth_month integer default null,
  p_birth_day integer default null
)
returns table (public_token text, existing boolean)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_program  public.loyalty_programs;
  v_customer public.customers;
  v_card     public.loyalty_cards;
begin
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED';
  end if;
  -- Cumpleaños opcional (día y mes, sin año). 29 de febrero es válido.
  if (p_birth_month is null) <> (p_birth_day is null) then raise exception 'INVALID_BIRTHDAY'; end if;
  if p_birth_month is not null then
    begin
      perform make_date(2000, p_birth_month, p_birth_day);
    exception when others then
      raise exception 'INVALID_BIRTHDAY';
    end;
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found or v_business.status = 'suspended' then
    raise exception 'BUSINESS_UNAVAILABLE';
  end if;

  select * into v_program from public.loyalty_programs
  where business_id = v_business.id and active
  order by created_at limit 1;
  if not found then
    raise exception 'PROGRAM_INACTIVE';
  end if;

  -- ¿Ya existe? Se devuelve su tarjeta sin modificar sus datos.
  select * into v_customer from public.customers
  where business_id = v_business.id and phone_e164 = p_phone_e164;

  if found then
    -- Recuperar la tarjeta exige el mismo nombre: con solo un número de celular
    -- nadie puede abrir la tarjeta (y ver el nombre) de otra persona.
    if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
      raise exception 'PHONE_REGISTERED';
    end if;
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    -- Freno en la base de datos (la app añade otro por IP): protege también a quien
    -- llame a la API pública directamente con la clave anónima.
    if (select count(*) from public.customers
        where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 60 then
      raise exception 'RATE_LIMITED';
    end if;
    -- Cupo de clientes del plan.
    if exists (select 1 from public.plans pl where pl.id = v_business.plan_id and pl.max_customers is not null
               and (select count(*) from public.customers where business_id = v_business.id) >= pl.max_customers) then
      raise exception 'PLAN_LIMIT_CUSTOMERS';
    end if;

    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at, birth_month, birth_day)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end, p_birth_month, p_birth_day)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
      if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
        raise exception 'PHONE_REGISTERED';
      end if;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id, current_stamps)
  values (v_business.id, v_program.id, v_customer.id, v_program.welcome_stamps)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false),
                                           'welcome_stamps', v_program.welcome_stamps));
  return query select v_card.public_token, false;
end;
$$;

-- ---------- Registrar visita: sede opcional ----------
drop function public.register_visit(uuid, text);
create function public.register_visit(p_card_id uuid, p_idempotency_key text, p_location_id uuid default null)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_card     public.loyalty_cards;
  v_program  public.loyalty_programs;
  v_status   public.business_status;
  v_visit_id uuid;
  v_reward_id uuid;
  v_stamps   integer;
  v_promo    public.promotions;
  v_bonus    integer := 0;
  v_tz       text;
  v_local    timestamp;
  v_customer public.customers;
  v_bday_id  uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_card.business_id) then raise exception 'FORBIDDEN'; end if;

  select status, timezone into v_status, v_tz from public.businesses where id = v_card.business_id;
  v_local := now() at time zone v_tz;
  if v_status = 'suspended' then raise exception 'BUSINESS_SUSPENDED'; end if;
  if v_card.status = 'blocked' then raise exception 'CARD_BLOCKED'; end if;
  -- La sede, si se indica, debe ser del mismo comercio y estar activa.
  if p_location_id is not null and not exists (
    select 1 from public.locations where id = p_location_id and business_id = v_card.business_id and active
  ) then
    raise exception 'INVALID_LOCATION';
  end if;

  if exists (select 1 from public.visits
             where business_id = v_card.business_id and idempotency_key = p_idempotency_key) then
    raise exception 'DUPLICATE_REQUEST';
  end if;

  select * into v_program from public.loyalty_programs where id = v_card.program_id;
  if not v_program.active then raise exception 'PROGRAM_INACTIVE'; end if;

  if v_card.last_visit_at is not null and v_program.min_minutes_between_visits > 0
     and v_card.last_visit_at > now() - make_interval(mins => v_program.min_minutes_between_visits) then
    raise exception 'TOO_SOON';
  end if;

  -- Promoción vigente hoy (p. ej. doble sello): suma sellos extra en la misma visita.
  select * into v_promo from private.active_promotion(v_card.business_id);
  v_bonus := coalesce(v_promo.bonus_stamps, 0);

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key, bonus_stamps, promotion_id, location_id)
  values (v_card.business_id, v_card.id, 'visit', 1, auth.uid(), p_idempotency_key, v_bonus, v_promo.id, p_location_id)
  returning id into v_visit_id;

  v_stamps := v_card.current_stamps + 1 + v_bonus;
  if v_stamps >= v_program.stamps_required then
    -- Los sellos que sobran pasan al siguiente ciclo (como máximo hasta quedar a uno de la meta).
    v_stamps := least(v_stamps - v_program.stamps_required, v_program.stamps_required - 1);
    insert into public.rewards (business_id, card_id, program_id, source_visit_id, name, expires_at)
    values (v_card.business_id, v_card.id, v_program.id, v_visit_id, v_program.reward_name,
            case when v_program.reward_expiry_days is not null
                 then now() + make_interval(days => v_program.reward_expiry_days) end)
    returning id into v_reward_id;
  end if;

  -- Regalo de cumpleaños: en la primera visita del mes de cumpleaños, una vez al año.
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_program.birthday_reward is not null and v_customer.birth_month = extract(month from v_local)::int then
    insert into public.rewards (business_id, card_id, program_id, name, kind, birthday_year, expires_at)
    values (v_card.business_id, v_card.id, v_program.id, v_program.birthday_reward, 'birthday',
            extract(year from v_local)::int, now() + interval '30 days')
    on conflict (card_id, birthday_year) do nothing
    returning id into v_bday_id;
  end if;

  update public.loyalty_cards
  set current_stamps = v_stamps,
      total_visits   = total_visits + 1,
      last_visit_at  = now(),
      status         = case when v_reward_id is not null or v_bday_id is not null then 'reward_available' else status end
  where id = v_card.id;

  perform private.audit(v_card.business_id, 'visit.created', 'visit', v_visit_id::text,
                        jsonb_build_object('card_id', v_card.id, 'bonus_stamps', v_bonus, 'promotion_id', v_promo.id));
  if v_bday_id is not null then
    perform private.audit(v_card.business_id, 'reward.birthday', 'reward', v_bday_id::text,
                          jsonb_build_object('card_id', v_card.id));
  end if;
  if v_reward_id is not null then
    perform private.audit(v_card.business_id, 'reward.earned', 'reward', v_reward_id::text,
                          jsonb_build_object('card_id', v_card.id));
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'reward_id', v_reward_id, 'current_stamps', v_stamps,
                            'bonus_stamps', v_bonus, 'birthday_reward_id', v_bday_id);
end;
$$;

revoke all on function public.register_visit(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.register_visit(uuid, text, uuid) to authenticated;

-- ---------- Estadísticas: visitas por sede ----------
create or replace function public.business_stats(p_business_id uuid, p_days integer)
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_tz       text;
  v_days     integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today    date;
  v_from     timestamptz;
  v_prev     timestamptz;
  v_required integer;
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;

  select timezone into v_tz from public.businesses where id = p_business_id;
  v_today := (now() at time zone v_tz)::date;
  v_from  := (v_today - (v_days - 1))::timestamp at time zone v_tz;
  v_prev  := (v_today - (2 * v_days - 1))::timestamp at time zone v_tz;

  select stamps_required into v_required from public.loyalty_programs
  where business_id = p_business_id and active order by created_at limit 1;
  v_required := coalesce(v_required, 1);

  return (
    with v as (
      -- Visitas netas: una visita revertida no cuenta.
      select vi.card_id, vi.staff_id, vi.location_id, vi.created_at, vi.created_at at time zone v_tz as local_at
      from public.visits vi
      where vi.business_id = p_business_id and vi.kind = 'visit' and vi.created_at >= v_prev
        and not exists (select 1 from public.visits r where r.reverses_visit_id = vi.id)
    ),
    cur as (select * from v where created_at >= v_from),
    red as (
      select staff_id from public.redemptions
      where business_id = p_business_id and created_at >= v_from
    ),
    staff as (
      select staff_id, sum(vis)::int as visits, sum(rd)::int as redemptions
      from (select staff_id, 1 as vis, 0 as rd from cur
            union all
            select staff_id, 0, 1 from red) u
      group by staff_id
    )
    select jsonb_build_object(
      'days', v_days,
      'visits', (select count(*) from cur),
      'visits_prev', (select count(*) from v where created_at < v_from),
      'reversals', (select count(*) from public.visits
                    where business_id = p_business_id and kind = 'reversal' and created_at >= v_from),
      'new_customers', (select count(*) from public.customers
                        where business_id = p_business_id and created_at >= v_from),
      'total_customers', (select count(*) from public.customers where business_id = p_business_id),
      'active_customers', (select count(distinct card_id) from cur),
      'returning_customers', (select count(*) from (select 1 from cur group by card_id having count(*) >= 2) x),
      'rewards_earned', (select count(*) from public.rewards
                         where business_id = p_business_id and status <> 'void' and earned_at >= v_from),
      'redemptions', (select count(*) from red),
      'rewards_available', (select count(*) from public.rewards
                            where business_id = p_business_id and status = 'available'
                              and (expires_at is null or expires_at > now())),
      'marketing_consent', (select count(*) from public.customers
                            where business_id = p_business_id and marketing_consent),
      'daily', (select jsonb_agg(jsonb_build_object(
                         'date', v_today - (v_days - 1) + i,
                         'value', (select count(*) from cur where local_at::date = v_today - (v_days - 1) + i))
                       order by i)
                from generate_series(0, v_days - 1) i),
      'weekday', (select jsonb_agg((select count(*) from cur where extract(isodow from local_at) = d) order by d)
                  from generate_series(1, 7) d),
      'hourly', (select jsonb_agg((select count(*) from cur where extract(hour from local_at) = h) order by h)
                 from generate_series(0, 23) h),
      'by_staff', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', coalesce(nullif(p.full_name, ''), p.email, 'Usuario eliminado'),
                 'visits', s.visits, 'redemptions', s.redemptions)
               order by s.visits desc, s.redemptions desc)
        from staff s left join public.profiles p on p.id = s.staff_id
      ), '[]'::jsonb),
      'by_location', coalesce((
        select jsonb_agg(jsonb_build_object('name', coalesce(l.name, 'Sin sede'), 'visits', x.n) order by x.n desc)
        from (select location_id, count(*) as n from cur group by location_id) x
        left join public.locations l on l.id = x.location_id
      ), '[]'::jsonb),
      'stamp_distribution', (
        select jsonb_agg((select count(*) from public.loyalty_cards c
                          where c.business_id = p_business_id and c.status <> 'blocked'
                            and least(c.current_stamps, v_required - 1) = s) order by s)
        from generate_series(0, v_required - 1) s)
    )
  );
end;
$$;

commit;
