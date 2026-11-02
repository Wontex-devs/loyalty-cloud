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
