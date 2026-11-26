-- Generado por npm run db:bundle. No editar: cambia las migraciones y vuelve a generarlo.
-- Incluye: 20261101000001_schema.sql, 20261101000002_rls.sql, 20261101000003_functions.sql, 20261101000004_reference_data.sql, 20261101000005_public_business.sql, 20261101000006_business_stats.sql, 20261101000007_pilot.sql, 20261101000008_customer_experience.sql, 20261101000009_promotions_birthdays.sql, 20261101000010_plans_locations.sql, 20261101000011_brand_assets.sql, 20261101000012_privacy_abuse.sql, 20261101000013_wallet_notifications.sql, 20261101000014_plan_prices.sql, 20261101000015_nfc_checkin.sql, 20261101000016_plan_prices_v2.sql, 20261101000017_eliminar_comercio.sql, 20261101000018_foto_tarjeta.sql, 20261101000019_panel_usuarios.sql, 20261101000020_apple_wallet.sql, 20261101000021_soporte_comercio.sql, 20261101000022_sello_propio_y_letras.sql, 20261101000023_visita_manual.sql, 20261101000024_nombre_aparte.sql, 20261101000025_sede_ubicacion.sql, 20261101000026_mensaje_cercania.sql, 20261101000027_estilo_tarjeta.sql, 20261101000027_superadmin_edita_comercio.sql, 20261101000028_estilo_marfil.sql, 20261101000029_reverso_pase.sql, 20261101000030_qr_tarjeta.sql, 20261101000031_eliminar_comercio_con_sedes.sql, 20261101000032_sello_cafe.sql, 20261101000033_ilustracion_franja.sql, 20261101000034_codigo_barras.sql, 20261101000035_toque_por_celular.sql, 20261101000036_control_cobros.sql, 20261101000037_nfc_limite_diario_y_ubicacion.sql, 20261101000038_limites_planes.sql, 20261101000039_segundo_mes_gratis.sql, 20261101000040_pagos_en_linea.sql, 20261101000041_pago_en_linea_cualquier_pasarela.sql, 20261101000042_letra_propia.sql, 20261101000043_recordatorios.sql, 20261101000044_demo.sql, 20261101000045_eliminar_cliente_superadmin.sql, 20261101000046_sello_sin_qr.sql
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

-- >>> 20261101000011_brand_assets.sql
-- =====================================================================
-- Etapa 10 · Personalización de la tarjeta
-- - Logotipo propio en Supabase Storage (bucket público brand-assets).
--   Cada comercio solo puede escribir en su carpeta: brand-assets/<business_id>/...
-- - Nuevas opciones de marca: icono del sello y tipografía de la tarjeta.
-- =====================================================================

-- ---------- Bucket del logotipo ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 1048576, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- La primera carpeta del archivo es el id del comercio; solo su dueño o admin la edita.
create function private.can_edit_brand_path(p_name text)
returns boolean
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.has_role(v_folder::uuid, '{owner,admin}') or private.is_superadmin();
end;
$$;
revoke all on function private.can_edit_brand_path(text) from public;
grant execute on function private.can_edit_brand_path(text) to authenticated;

create policy brand_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));
create policy brand_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));
create policy brand_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and private.can_edit_brand_path(name))
  with check (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));
create policy brand_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));

-- ---------- Validación de la marca ----------
create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k = 'logoUrl' then
        -- Vacío = quitar el logo. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans') then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000012_privacy_abuse.sql
-- =====================================================================
-- Etapa 11 · Derechos de las clientas y freno a inscripciones falsas
-- - A1: el propietario puede eliminar los datos personales de una clienta
--   (Ley 1581, supresión). Se anonimiza: las visitas siguen en el historial
--   sin nombre, teléfono, correo ni cumpleaños, y su tarjeta deja de existir.
-- - A2: el consentimiento de marketing se puede retirar desde el panel o
--   desde la propia tarjeta de la clienta.
-- - A3: la inscripción ya no se puede llamar con la clave pública: solo el
--   servidor (service_role), que además aplica un límite por IP.
-- =====================================================================

-- ---------- A1 · Anonimizar ----------
alter table public.customers alter column phone_e164 drop not null;
alter table public.customers add column anonymized_at timestamptz;
alter table public.customers add constraint customers_anonymized_check check (
  case when anonymized_at is null then phone_e164 is not null
       else phone_e164 is null and email is null and birth_month is null and birth_day is null and not marketing_consent end
);

-- Una clienta anonimizada ya no se edita.
drop policy customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (private.has_role(business_id, '{owner,admin}') and anonymized_at is null)
  with check (private.has_role(business_id, '{owner,admin}') and anonymized_at is null);

create function public.anonymize_customer(p_customer_id uuid)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not private.has_role(v_customer.business_id, '{owner}') then raise exception 'FORBIDDEN'; end if;
  if v_customer.anonymized_at is not null then raise exception 'ALREADY_ANONYMIZED'; end if;

  update public.customers
  set full_name = 'Datos eliminados', phone_e164 = null, email = null,
      birth_month = null, birth_day = null,
      marketing_consent = false, marketing_consent_at = null,
      anonymized_at = now()
  where id = v_customer.id;

  -- El enlace anterior deja de funcionar y la tarjeta no admite más movimientos.
  update public.loyalty_cards
  set status = 'blocked', public_token = private.generate_public_token()
  where customer_id = v_customer.id;

  update public.rewards r
  set status = 'void', status_changed_at = now()
  from public.loyalty_cards c
  where c.customer_id = v_customer.id and r.card_id = c.id and r.status = 'available';

  perform private.audit(v_customer.business_id, 'customer.anonymized', 'customer', v_customer.id::text);
end;
$$;

-- Una tarjeta de una clienta anonimizada no se puede reactivar.
create or replace function public.set_card_blocked(p_card_id uuid, p_blocked boolean)
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
  if not p_blocked and exists (select 1 from public.customers where id = v_card.customer_id and anonymized_at is not null) then
    raise exception 'CUSTOMER_ANONYMIZED';
  end if;

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

-- ---------- A2 · Retirar el consentimiento de marketing ----------
create function public.revoke_marketing_consent(p_customer_id uuid)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not private.has_role(v_customer.business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if not v_customer.marketing_consent then return; end if;

  update public.customers set marketing_consent = false, marketing_consent_at = null where id = v_customer.id;
  perform private.audit(v_customer.business_id, 'customer.marketing_revoked', 'customer', v_customer.id::text,
                        jsonb_build_object('source', 'panel'));
end;
$$;

-- La propia clienta, desde su tarjeta (el token es el secreto de la tarjeta).
create function public.unsubscribe_marketing(p_token text)
returns boolean
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select cu.* into v_customer
  from public.loyalty_cards c join public.customers cu on cu.id = c.customer_id
  where c.public_token = p_token
  for update of cu;
  if not found then return false; end if;
  if v_customer.marketing_consent then
    update public.customers set marketing_consent = false, marketing_consent_at = null where id = v_customer.id;
    perform private.audit(v_customer.business_id, 'customer.marketing_revoked', 'customer', v_customer.id::text,
                          jsonb_build_object('source', 'card'));
  end if;
  return true;
end;
$$;

-- La tarjeta pública indica si la clienta acepta mensajes (para mostrar la opción de darse de baja).
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
    'marketing_consent', cu.marketing_consent,
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
    and b.status <> 'suspended'
    and cu.anonymized_at is null;
$$;

-- ---------- A3 · Inscripción solo desde el servidor, con límite por IP ----------
-- Guarda un hash (HMAC) de la IP, nunca la IP. Fuera del alcance de la API.
create table private.join_attempts (
  client_key text not null,
  created_at timestamptz not null default now()
);
create index join_attempts_key_idx on private.join_attempts (client_key, created_at);
create index join_attempts_created_idx on private.join_attempts (created_at);

create function public.join_program_limited(
  p_client_key text,
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
begin
  if p_client_key is not null then
    delete from private.join_attempts where created_at < now() - interval '1 day';
    -- 20 intentos por hora y conexión: alcanza para la wifi de un salón lleno.
    if (select count(*) from private.join_attempts
        where client_key = p_client_key and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'RATE_LIMITED';
    end if;
    insert into private.join_attempts (client_key) values (p_client_key);
  end if;
  return query select * from public.join_program(p_slug, p_full_name, p_phone_e164, p_email, p_accept_terms,
                                                 p_marketing_consent, p_birth_month, p_birth_day);
end;
$$;

-- ---------- Permisos ----------
revoke all on function public.join_program(text, text, text, text, boolean, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.join_program(text, text, text, text, boolean, boolean, integer, integer) to service_role;

revoke all on function public.join_program_limited(text, text, text, text, text, boolean, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.join_program_limited(text, text, text, text, text, boolean, boolean, integer, integer)
  to service_role;

revoke all on function public.anonymize_customer(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_customer(uuid) to authenticated;
revoke all on function public.revoke_marketing_consent(uuid) from public, anon, authenticated;
grant execute on function public.revoke_marketing_consent(uuid) to authenticated;
revoke all on function public.unsubscribe_marketing(text) from public, anon, authenticated;
grant execute on function public.unsubscribe_marketing(text) to anon, authenticated;

-- Hallazgo B2: funciones de trigger sin permiso de ejecución directa.
revoke all on function private.audit_config_change() from public, anon, authenticated;
revoke all on function private.enforce_plan_limits() from public, anon, authenticated;

-- >>> 20261101000013_wallet_notifications.sql
-- =====================================================================
-- Etapa 12 · Avisos en la billetera (Google Wallet; Apple Wallet usará lo mismo)
-- - Cada comercio elige qué avisos automáticos envía.
-- - Cada aviso queda registrado una sola vez (card_id, ref): no se repite
--   aunque se reintente la visita o el proceso diario.
-- - Los avisos de visita son transaccionales; cumpleaños, "te extrañamos" y
--   campañas exigen el consentimiento de marketing.
-- =====================================================================

-- ---------- Ajustes por comercio ----------
create function private.valid_wallet_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k
                    where k not in ('stamp', 'near', 'reward', 'birthday', 'winback', 'winbackDays'))
    and jsonb_typeof(s -> 'stamp') = 'boolean'
    and jsonb_typeof(s -> 'near') = 'boolean'
    and jsonb_typeof(s -> 'reward') = 'boolean'
    and jsonb_typeof(s -> 'birthday') = 'boolean'
    and jsonb_typeof(s -> 'winback') = 'boolean'
    and jsonb_typeof(s -> 'winbackDays') = 'number'
    and (s ->> 'winbackDays') ~ '^[0-9]+$'
    and (s ->> 'winbackDays')::int between 14 and 180;
$$;

alter table public.businesses
  add column wallet_notifications jsonb not null
    default '{"stamp": true, "near": true, "reward": true, "birthday": true, "winback": true, "winbackDays": 45}'::jsonb
    check (private.valid_wallet_settings(wallet_notifications));

create function public.update_wallet_settings(p_business_id uuid, p_settings jsonb)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if not private.valid_wallet_settings(p_settings) then raise exception 'INVALID_WALLET_SETTINGS'; end if;
  update public.businesses set wallet_notifications = p_settings where id = p_business_id;
  perform private.audit(p_business_id, 'wallet.settings_updated', 'business', p_business_id::text, p_settings);
end;
$$;

-- ---------- Registro de avisos ----------
create table public.wallet_notifications (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  card_id      uuid not null,
  kind         text not null check (kind in ('stamp', 'near', 'reward', 'birthday', 'winback', 'campaign')),
  -- Clave que impide repetir el mismo aviso: visit:<clave>, birthday:<año>, winback:<última visita>, campaign:<id>.
  ref          text not null check (length(ref) between 3 and 120),
  title        text not null check (length(title) between 1 and 60),
  body         text not null check (length(body) between 1 and 300),
  status       text not null default 'pending' check (status in ('pending', 'sent', 'not_saved', 'failed')),
  staff_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (card_id, ref),
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade
);
create index wallet_notifications_business_idx on public.wallet_notifications (business_id, created_at desc);
create index wallet_notifications_card_idx on public.wallet_notifications (card_id, kind, created_at desc);

alter table public.wallet_notifications enable row level security;
grant select on public.wallet_notifications to authenticated;
grant all on public.wallet_notifications to service_role;
-- Solo lectura para el panel; escribe el servidor (service_role) o las funciones de abajo.
create policy wallet_notifications_read on public.wallet_notifications for select to authenticated
  using (private.has_role(business_id, '{owner,admin}'));

-- ---------- Campañas: un botón para todo un grupo ----------
-- Filtra a quienes aceptaron mensajes, siguen activas y no recibieron otra campaña en 7 días.
create function public.queue_wallet_campaign(p_business_id uuid, p_customer_ids uuid[], p_title text, p_body text)
returns table (notification_id uuid, public_token text, title text, body text)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_ref text := 'campaign:' || gen_random_uuid()::text;
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 40
     or p_body is null or length(trim(p_body)) not between 1 and 240 then
    raise exception 'INVALID_WALLET_MESSAGE';
  end if;
  if coalesce(array_length(p_customer_ids, 1), 0) not between 1 and 2000 then raise exception 'INVALID_WALLET_MESSAGE'; end if;
  if exists (select 1 from public.businesses where id = p_business_id and status = 'suspended') then
    raise exception 'BUSINESS_SUSPENDED';
  end if;

  return query
  with eligible as (
    select c.id as card_id, c.public_token as token, cu.full_name
    from public.customers cu
    join public.loyalty_cards c on c.customer_id = cu.id and c.business_id = cu.business_id
    where cu.business_id = p_business_id
      and cu.id = any (p_customer_ids)
      and cu.marketing_consent
      and cu.anonymized_at is null
      and c.status <> 'blocked'
      and not exists (select 1 from public.wallet_notifications n
                      where n.card_id = c.id and n.kind = 'campaign' and n.created_at > now() - interval '7 days')
  ), ins as (
    insert into public.wallet_notifications (business_id, card_id, kind, ref, title, body, staff_id)
    select p_business_id, e.card_id, 'campaign', v_ref, trim(p_title),
           left(replace(trim(p_body), '{nombre}', split_part(trim(e.full_name), ' ', 1)), 300), auth.uid()
    from eligible e
    on conflict (card_id, ref) do nothing
    returning id, card_id, wallet_notifications.title, wallet_notifications.body
  )
  select ins.id, e.token, ins.title, ins.body from ins join eligible e on e.card_id = ins.card_id;

  perform private.audit(p_business_id, 'wallet.campaign_queued', 'business', p_business_id::text,
                        jsonb_build_object('ref', v_ref, 'title', trim(p_title)));
end;
$$;

-- ---------- Proceso diario: cumpleaños y "te extrañamos" (solo el servidor) ----------
create function public.wallet_daily_candidates(p_now timestamptz default now())
returns table (business_id uuid, card_id uuid, public_token text, kind text, ref text,
               first_name text, business_name text, current_stamps integer, stamps_required integer, reward_name text)
language sql
stable security definer
set search_path = ''
as $$
  with base as (
    select b.id as business_id, b.name as business_name, b.wallet_notifications as s,
           (p_now at time zone b.timezone) as local_now,
           c.id as card_id, c.public_token, c.current_stamps, c.last_visit_at,
           cu.full_name, cu.birth_month, cu.birth_day,
           p.stamps_required, p.reward_name
    from public.businesses b
    join public.loyalty_cards c on c.business_id = b.id
    join public.customers cu on cu.id = c.customer_id
    join public.loyalty_programs p on p.id = c.program_id
    where b.status <> 'suspended'
      and c.status <> 'blocked'
      and cu.marketing_consent
      and cu.anonymized_at is null
  )
  select business_id, card_id, public_token, 'birthday', 'birthday:' || extract(year from local_now)::int,
         split_part(trim(full_name), ' ', 1), business_name, current_stamps, stamps_required, reward_name
  from base
  where (s ->> 'birthday')::boolean
    and birth_month = extract(month from local_now)::int
    and coalesce(birth_day, 1) = extract(day from local_now)::int
  union all
  select business_id, card_id, public_token, 'winback', 'winback:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         split_part(trim(full_name), ' ', 1), business_name, current_stamps, stamps_required, reward_name
  from base
  where (s ->> 'winback')::boolean
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => (s ->> 'winbackDays')::int)
    -- Solo quienes se enfriaron hace poco: al activar el aviso no se escribe a clientes de hace años.
    and last_visit_at > p_now - make_interval(days => (s ->> 'winbackDays')::int + 30);
$$;

-- ---------- Permisos ----------
revoke all on function private.valid_wallet_settings(jsonb) from public, anon, authenticated;
grant execute on function private.valid_wallet_settings(jsonb) to authenticated, service_role;
revoke all on function public.update_wallet_settings(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_wallet_settings(uuid, jsonb) to authenticated;
revoke all on function public.queue_wallet_campaign(uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.queue_wallet_campaign(uuid, uuid[], text, text) to authenticated;
revoke all on function public.wallet_daily_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_daily_candidates(timestamptz) to service_role;

-- >>> 20261101000014_plan_prices.sql
-- Precios y límites comerciales. Business se ajusta a cada negocio: su precio aquí es solo una referencia.
update public.plans set price_monthly = 59900, max_customers = 100,
  features = array['1 programa', 'Hasta 100 clientes', '2 empleados', '1 sede']
where id = 'plan_starter';
update public.plans set price_monthly = 119900, max_customers = 300,
  features = array['3 programas', 'Hasta 300 clientes', '10 empleados', 'Hasta 3 sedes']
where id = 'plan_pro';
update public.plans set features = array['Plan a la medida', 'Clientes, equipo y sedes según tu negocio', 'Soporte prioritario']
where id = 'plan_business';

-- >>> 20261101000015_nfc_checkin.sql
-- Etapa 13: visita por toque NFC.
-- El comercio pega una etiqueta NFC en el mostrador con un enlace secreto. La clienta acerca el celular,
-- se abre su tarjeta y se registra el sello. Reglas nuevas:
--   · el secreto vive en `private`, fuera del alcance de la API y de los empleados;
--   · solo el servidor (service_role) puede registrar una visita por toque;
--   · cada visita guarda su origen (`staff` o `nfc`) y queda en el historial, donde se puede revertir;
--   · entre dos toques debe pasar el tiempo mínimo del programa, o el del comercio si es mayor (por defecto 2 horas).

-- ---------- Origen de la visita ----------
alter table public.visits
  add column source text not null default 'staff' check (source in ('staff', 'nfc'));

-- ---------- Ajustes de NFC por comercio (privados) ----------
create table private.business_nfc (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  enabled      boolean not null default false,
  secret       text not null default private.generate_public_token(),
  min_minutes  integer not null default 120 check (min_minutes between 0 and 1440),
  updated_at   timestamptz not null default now()
);

-- ---------- Núcleo de la visita (compartido por el escáner y el toque NFC) ----------
-- Es el cuerpo de register_visit de la Etapa 10, sin cambios de reglas.
-- Quien lo llama ya comprobó los permisos: el empleado (register_visit) o la etiqueta (register_nfc_visit).
create function private.record_visit(
  p_card_id uuid,
  p_idempotency_key text,
  p_location_id uuid,
  p_staff uuid,
  p_source text,
  p_min_minutes integer
)
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
  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;

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

  if v_card.last_visit_at is not null
     and greatest(v_program.min_minutes_between_visits, coalesce(p_min_minutes, 0)) > 0
     and v_card.last_visit_at > now() - make_interval(mins => greatest(v_program.min_minutes_between_visits, coalesce(p_min_minutes, 0))) then
    raise exception 'TOO_SOON';
  end if;

  -- Promoción vigente hoy (p. ej. doble sello): suma sellos extra en la misma visita.
  select * into v_promo from private.active_promotion(v_card.business_id);
  v_bonus := coalesce(v_promo.bonus_stamps, 0);

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key, bonus_stamps, promotion_id, location_id, source)
  values (v_card.business_id, v_card.id, 'visit', 1, p_staff, p_idempotency_key, v_bonus, v_promo.id, p_location_id, p_source)
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
                        jsonb_build_object('card_id', v_card.id, 'bonus_stamps', v_bonus, 'promotion_id', v_promo.id, 'source', p_source));
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

-- ---------- Registrar visita (empleado): mismas reglas de siempre, ahora sobre el núcleo ----------
create or replace function public.register_visit(p_card_id uuid, p_idempotency_key text, p_location_id uuid default null)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select business_id into v_business from public.loyalty_cards where id = p_card_id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_business) then raise exception 'FORBIDDEN'; end if;
  return private.record_visit(p_card_id, p_idempotency_key, p_location_id, auth.uid(), 'staff', 0);
end;
$$;

-- ---------- Registrar visita por toque NFC (solo el servidor) ----------
create function public.register_nfc_visit(p_slug text, p_secret text, p_card_token text, p_idempotency_key text)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_nfc      private.business_nfc;
  v_card     public.loyalty_cards;
  v_result   jsonb;
begin
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  if v_business.status = 'suspended' then raise exception 'BUSINESS_SUSPENDED'; end if;

  select * into v_nfc from private.business_nfc where business_id = v_business.id;
  if not found or not v_nfc.enabled then raise exception 'NFC_DISABLED'; end if;
  if p_secret is null or p_secret <> v_nfc.secret then raise exception 'INVALID_TAG'; end if;

  select * into v_card from public.loyalty_cards
  where public_token = p_card_token and business_id = v_business.id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;

  v_result := private.record_visit(v_card.id, p_idempotency_key, null, null, 'nfc', v_nfc.min_minutes);
  return v_result || jsonb_build_object('card_id', v_card.id, 'business_id', v_business.id);
end;
$$;

revoke all on function public.register_nfc_visit(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_nfc_visit(text, text, text, text) to service_role;

-- ---------- Ajustes de NFC en el panel (dueño, administrador o superadmin) ----------
create function public.get_nfc_settings(p_business_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_nfc private.business_nfc;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  insert into private.business_nfc (business_id) values (p_business_id) on conflict (business_id) do nothing;
  select * into v_nfc from private.business_nfc where business_id = p_business_id;
  return jsonb_build_object('enabled', v_nfc.enabled, 'secret', v_nfc.secret, 'min_minutes', v_nfc.min_minutes);
end;
$$;

create function public.set_nfc_settings(
  p_business_id uuid,
  p_enabled boolean,
  p_min_minutes integer,
  p_rotate boolean default false
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_nfc private.business_nfc;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_min_minutes is null or p_min_minutes not between 0 and 1440 then raise exception 'INVALID_NFC_SETTINGS'; end if;

  insert into private.business_nfc (business_id) values (p_business_id) on conflict (business_id) do nothing;
  update private.business_nfc
  set enabled     = coalesce(p_enabled, false),
      min_minutes = p_min_minutes,
      secret      = case when coalesce(p_rotate, false) then private.generate_public_token() else secret end,
      updated_at  = now()
  where business_id = p_business_id
  returning * into v_nfc;

  -- El secreto nunca va a la auditoría.
  perform private.audit(p_business_id, 'nfc.settings', 'business', p_business_id::text,
                        jsonb_build_object('enabled', v_nfc.enabled, 'min_minutes', v_nfc.min_minutes,
                                           'secret_rotated', coalesce(p_rotate, false)));
  return jsonb_build_object('enabled', v_nfc.enabled, 'secret', v_nfc.secret, 'min_minutes', v_nfc.min_minutes);
end;
$$;

revoke all on function public.get_nfc_settings(uuid) from public, anon, authenticated;
revoke all on function public.set_nfc_settings(uuid, boolean, integer, boolean) from public, anon, authenticated;
grant execute on function public.get_nfc_settings(uuid) to authenticated;
grant execute on function public.set_nfc_settings(uuid, boolean, integer, boolean) to authenticated;

-- >>> 20261101000016_plan_prices_v2.sql
-- Nuevos precios mensuales: Starter $79.990 y Pro $139.990. Business sigue a la medida.
update public.plans set price_monthly = 79990 where id = 'plan_starter';
update public.plans set price_monthly = 139990 where id = 'plan_pro';

-- >>> 20261101000017_eliminar_comercio.sql
-- =====================================================================
-- Eliminar un comercio completo (solo superadministradores).
-- - El historial (visitas, canjes, contactos, auditoría) sigue siendo inmodificable.
--   Única excepción nueva: se borra entero cuando se elimina SU comercio, y solo
--   dentro de public.admin_delete_business (marca de sesión + rol del dueño de la función).
-- - Hay que escribir el identificador (slug) del comercio para confirmar.
-- - La eliminación queda en la auditoría de la plataforma (sin comercio).
-- =====================================================================

create or replace function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
  v_borrando text := current_setting('lazo.eliminando_comercio', true);
begin
  if tg_op = 'UPDATE' and actor_col is not null
     and (to_jsonb(new) ->> actor_col) is null
     and (to_jsonb(new) - actor_col) = (to_jsonb(old) - actor_col) then
    return new;
  end if;
  -- Borrado en cascada del comercio completo, solo desde admin_delete_business.
  if tg_op = 'DELETE'
     and coalesce(v_borrando, '') <> ''
     and current_user not in ('anon', 'authenticated', 'service_role')
     and (to_jsonb(old) ->> 'business_id') = v_borrando then
    return old;
  end if;
  raise exception 'IMMUTABLE_LEDGER: % no admite %', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

-- Al borrar el comercio no se audita cada miembro que se va con él
-- (la fila apuntaría a un comercio que ya no existe).
create or replace function private.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('lazo.eliminando_comercio', true), '') = old.business_id::text then
    return old;
  end if;
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
revoke all on function private.audit_config_change() from public, anon, authenticated;

create function public.admin_delete_business(p_business_id uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.businesses;
begin
  if not private.is_superadmin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_b from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_confirm_slug is distinct from v_b.slug then
    raise exception 'CONFIRMATION_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata)
  values (null, auth.uid(), 'platform.business_deleted', 'business', v_b.id::text,
          jsonb_build_object('slug', v_b.slug, 'name', v_b.name, 'plan', v_b.plan_id));

  perform set_config('lazo.eliminando_comercio', v_b.id::text, true);
  delete from public.businesses where id = v_b.id;
  perform set_config('lazo.eliminando_comercio', '', true);
end;
$$;
revoke all on function public.admin_delete_business(uuid, text) from public, anon;
grant execute on function public.admin_delete_business(uuid, text) to authenticated;

-- >>> 20261101000018_foto_tarjeta.sql
-- =====================================================================
-- Foto de fondo de la tarjeta y colores iniciales nuevos.
-- - coverUrl sigue la misma regla que logoUrl: vacío para quitarla o una imagen
--   de la carpeta del propio comercio en Storage.
-- - Los comercios nuevos arrancan con los colores de Lazo; los existentes no cambian.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl') then
        -- Vacío = quitar el logo. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans') then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

create or replace function public.create_business(
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
          jsonb_build_object('logoText', upper(left(trim(p_name), 2)), 'primary', '#1b3fd8',
                             'primaryForeground', '#ffc928', 'accent', '#ffc928',
                             'cardBackground', '#1b3fd8', 'cardForeground', '#ffc928'))
  returning id into v_id;

  insert into public.loyalty_programs (business_id, name, stamps_required, reward_name)
  values (v_id, trim(p_name), p_stamps_required, p_reward_name);

  perform private.audit(null, 'business.created', 'business', v_id::text, jsonb_build_object('slug', p_slug));
  return v_id;
end;
$$;

-- >>> 20261101000019_panel_usuarios.sql
-- =====================================================================
-- Etapa 19 · Panel de la plataforma: gestión de usuarios
--  * Rol de plataforma «support» (Soporte): ve el panel de la plataforma, pero no cambia nada.
--  * Cuentas suspendidas: pierden el acceso de inmediato (lo comprueban las funciones de RLS).
--  * Registro de inicios de sesión (solo fecha y método; sin IP ni dispositivo).
--  * Funciones de administración que validan permisos y dejan auditoría en la misma transacción.
-- Nota: el valor nuevo del enum no se usa como literal en este archivo (se compara como texto),
-- porque Postgres no permite usar un valor de enum en la misma transacción en que se crea.
-- =====================================================================

alter type public.platform_role add value if not exists 'support';

-- ---------- Estado de la cuenta ----------
alter table public.profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid references public.profiles (id) on delete set null;

-- ---------- Funciones de autorización: una cuenta suspendida no tiene permisos ----------
create or replace function private.is_superadmin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'superadmin' and suspended_at is null
  );
$$;

-- Superadministrador o Soporte: pueden LEER el panel de la plataforma.
create or replace function private.is_platform_reader()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role::text in ('superadmin', 'support') and suspended_at is null
  );
$$;

create or replace function private.is_member(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business and m.profile_id = auth.uid() and m.active and p.suspended_at is null
  );
$$;

create or replace function private.has_role(p_business uuid, p_roles public.business_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business and m.profile_id = auth.uid() and m.active and m.role = any (p_roles)
      and p.suspended_at is null
  );
$$;

create or replace function private.can_redeem(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business and m.profile_id = auth.uid() and m.active
      and (m.role in ('owner', 'admin') or m.can_redeem) and p.suspended_at is null
  );
$$;

revoke all on function private.is_platform_reader() from public;
grant execute on function private.is_platform_reader() to authenticated;

-- ---------- Lectura del panel para Soporte (solo lectura; escribir sigue siendo solo del superadministrador) ----------
drop policy if exists businesses_read on public.businesses;
create policy businesses_read on public.businesses for select to authenticated
  using (private.is_member(id) or private.is_platform_reader());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_platform_reader() or private.shares_business(id));

drop policy if exists memberships_read on public.business_memberships;
create policy memberships_read on public.business_memberships for select to authenticated
  using (profile_id = auth.uid() or private.is_member(business_id) or private.is_platform_reader());

drop policy if exists programs_read on public.loyalty_programs;
create policy programs_read on public.loyalty_programs for select to authenticated
  using (private.is_member(business_id) or private.is_platform_reader());

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
  using (
    (business_id is not null and private.has_role(business_id, '{owner,admin}'))
    or private.is_platform_reader()
  );

create or replace function public.platform_business_stats()
returns table (business_id uuid, customers bigint, visits_30d bigint, redemptions_30d bigint)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not private.is_platform_reader() then raise exception 'FORBIDDEN'; end if;
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

-- Búsquedas de la auditoría por persona.
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------- Registro de inicios de sesión ----------
create table if not exists public.login_events (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  method      text not null check (method in ('password', 'magic_link', 'invite', 'recovery')),
  created_at  timestamptz not null default now()
);
create index if not exists login_events_profile_idx on public.login_events (profile_id, created_at desc);
create index if not exists login_events_created_idx on public.login_events (created_at desc);
alter table public.login_events enable row level security;
grant select on public.login_events to authenticated;
grant all on public.login_events to service_role;
drop policy if exists login_events_read on public.login_events;
create policy login_events_read on public.login_events for select to authenticated
  using (profile_id = auth.uid() or private.is_platform_reader());

-- La persona que acaba de entrar deja su registro (no se puede escribir a nombre de otra).
create or replace function public.record_login(p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_method not in ('password', 'magic_link', 'invite', 'recovery') then raise exception 'INVALID_INPUT'; end if;
  -- Un mismo inicio puede pasar dos veces por el servidor: se ignora si hubo uno hace menos de un minuto.
  if exists (select 1 from public.login_events where profile_id = auth.uid() and created_at > now() - interval '1 minute') then
    return;
  end if;
  insert into public.login_events (profile_id, method) values (auth.uid(), p_method);
end;
$$;

-- ---------- Listado de usuarios para el panel (incluye último acceso desde Auth) ----------
create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  platform_role text,
  created_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  logins_30d bigint
)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not private.is_platform_reader() then raise exception 'FORBIDDEN'; end if;
  return query
  select p.id, p.full_name, p.email, p.platform_role::text, p.created_at, p.suspended_at, p.suspended_reason,
         u.last_sign_in_at, u.email_confirmed_at, u.invited_at,
         (select count(*) from public.login_events l where l.profile_id = p.id and l.created_at > now() - interval '30 days')
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

-- ---------- Cambiar el rol de plataforma ----------
create or replace function public.admin_set_platform_role(p_profile_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('superadmin', 'support', 'user') then raise exception 'INVALID_INPUT'; end if;
  if p_profile_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;

  select platform_role::text into v_old from public.profiles where id = p_profile_id for update;
  if v_old is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_old = p_role then return; end if;

  if v_old = 'superadmin' and (
    select count(*) from public.profiles where platform_role = 'superadmin' and suspended_at is null and id <> p_profile_id
  ) = 0 then
    raise exception 'LAST_SUPERADMIN';
  end if;

  update public.profiles set platform_role = p_role::public.platform_role where id = p_profile_id;
  perform private.audit(null, 'platform.role_changed', 'profile', p_profile_id::text,
                        jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

-- ---------- Suspender y reactivar ----------
create or replace function public.admin_set_user_suspension(p_profile_id uuid, p_suspend boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_suspended timestamptz;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_profile_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  if v_reason is not null and length(v_reason) > 300 then raise exception 'INVALID_INPUT'; end if;

  select platform_role::text, suspended_at into v_role, v_suspended from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  if p_suspend then
    if v_suspended is not null then return; end if;
    if v_role = 'superadmin' and (
      select count(*) from public.profiles where platform_role = 'superadmin' and suspended_at is null and id <> p_profile_id
    ) = 0 then
      raise exception 'LAST_SUPERADMIN';
    end if;
    update public.profiles
       set suspended_at = now(), suspended_reason = v_reason, suspended_by = auth.uid()
     where id = p_profile_id;
    perform private.audit(null, 'platform.user_suspended', 'profile', p_profile_id::text,
                          jsonb_build_object('reason', v_reason));
  else
    if v_suspended is null then return; end if;
    update public.profiles
       set suspended_at = null, suspended_reason = null, suspended_by = null
     where id = p_profile_id;
    perform private.audit(null, 'platform.user_reactivated', 'profile', p_profile_id::text, '{}'::jsonb);
  end if;
end;
$$;

-- ---------- Editar datos de la cuenta ----------
create or replace function public.admin_update_profile(p_profile_id uuid, p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_new text := btrim(coalesce(p_full_name, ''));
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if length(v_new) < 2 or length(v_new) > 80 then raise exception 'INVALID_INPUT'; end if;
  select full_name into v_old from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_old = v_new then return; end if;
  update public.profiles set full_name = v_new where id = p_profile_id;
  perform private.audit(null, 'platform.profile_updated', 'profile', p_profile_id::text,
                        jsonb_build_object('field', 'full_name', 'from', v_old, 'to', v_new));
end;
$$;

-- ---------- Acciones sin cambio en la base que igual deben quedar registradas ----------
create or replace function public.admin_record_action(p_action text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_action not in ('platform.password_reset_sent', 'platform.users_exported', 'platform.audit_exported', 'platform.access_link_sent') then
    raise exception 'INVALID_INPUT';
  end if;
  perform private.audit(null, p_action, case when p_action like '%exported' then 'export' else 'profile' end,
                        coalesce(p_entity_id, ''), coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- ---------- Permisos de ejecución ----------
revoke all on function
  public.record_login(text),
  public.admin_list_users(),
  public.admin_set_platform_role(uuid, text),
  public.admin_set_user_suspension(uuid, boolean, text),
  public.admin_update_profile(uuid, text),
  public.admin_record_action(text, text, jsonb)
from public, anon;

grant execute on function
  public.record_login(text),
  public.admin_list_users(),
  public.admin_set_platform_role(uuid, text),
  public.admin_set_user_suspension(uuid, boolean, text),
  public.admin_update_profile(uuid, text),
  public.admin_record_action(text, text, jsonb)
to authenticated;

-- >>> 20261101000020_apple_wallet.sql
-- =====================================================================
-- Etapa 20 · Apple Wallet
--  * Cada iPhone que guarda un pase se registra en nuestro servicio web (protocolo de Apple):
--    se guarda su identificador de dispositivo y el token para avisarle por APNs.
--  * pass_updated_at marca cuándo cambió el pase: el iPhone pregunta «qué cambió desde…».
--  * Solo el servidor (service_role) lee y escribe: el panel no necesita estos datos.
--  * Al borrar la tarjeta (o el comercio) se borran sus registros.
-- =====================================================================

create table if not exists public.apple_wallet_registrations (
  device_library_id text not null check (length(device_library_id) between 1 and 128),
  card_id           uuid not null,
  business_id       uuid not null,
  push_token        text not null check (length(push_token) between 1 and 200),
  pass_updated_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  primary key (device_library_id, card_id),
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade
);
create index if not exists apple_wallet_registrations_card_idx on public.apple_wallet_registrations (card_id);
create index if not exists apple_wallet_registrations_business_idx on public.apple_wallet_registrations (business_id);

alter table public.apple_wallet_registrations enable row level security;
revoke all on public.apple_wallet_registrations from public, anon, authenticated;
grant all on public.apple_wallet_registrations to service_role;

-- >>> 20261101000021_soporte_comercio.sql
-- =====================================================================
-- Etapa 21 · Ver como el comercio (soporte en modo solo lectura)
--  * Un superadministrador o Soporte puede abrir el panel de un comercio SOLO PARA LEER,
--    escribiendo el motivo. El acceso dura como máximo 2 horas (por defecto 1).
--  * Cada entrada queda en la auditoría DEL COMERCIO: su dueño y sus administradores la ven.
--  * No da permisos de escritura: las funciones de escritura siguen exigiendo membresía
--    (has_role / is_member), que no cambian. Solo se amplían las políticas de LECTURA.
--  * Datos personales de clientes (Ley 1581): se ven únicamente durante una sesión abierta con
--    motivo, nunca de forma permanente desde el panel de la plataforma.
-- =====================================================================

create table if not exists public.support_sessions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  reason      text not null check (length(btrim(reason)) between 5 and 300),
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  check (expires_at > started_at and expires_at <= started_at + interval '2 hours')
);
create index if not exists support_sessions_active_idx on public.support_sessions (profile_id, business_id, expires_at desc);

alter table public.support_sessions enable row level security;
revoke all on public.support_sessions from public, anon, authenticated;
grant select on public.support_sessions to authenticated;
grant all on public.support_sessions to service_role;
-- Cada quien ve sus sesiones; los lectores de la plataforma ven todas. Se escriben solo con las funciones.
create policy support_sessions_read on public.support_sessions for select to authenticated
  using (profile_id = auth.uid() or private.is_platform_reader());

-- ¿Tiene el usuario una sesión de soporte abierta en este comercio?
create or replace function private.has_support_access(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_platform_reader() and exists (
    select 1 from public.support_sessions s
    where s.profile_id = auth.uid() and s.business_id = p_business
      and s.ended_at is null and s.expires_at > now()
  );
$$;
revoke all on function private.has_support_access(uuid) from public;
grant execute on function private.has_support_access(uuid) to authenticated;

-- ---------- Abrir y cerrar la sesión ----------
create or replace function public.start_support_session(p_business_id uuid, p_reason text, p_minutes integer default 60)
returns timestamptz
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_minutes integer := least(greatest(coalesce(p_minutes, 60), 15), 120);
  v_expires timestamptz := now() + make_interval(mins => v_minutes);
  v_name text;
begin
  if not private.is_platform_reader() then raise exception 'FORBIDDEN'; end if;
  if length(v_reason) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select name into v_name from public.businesses where id = p_business_id;
  if v_name is null then raise exception 'NOT_FOUND'; end if;

  -- Una sola sesión abierta por persona y comercio.
  update public.support_sessions set ended_at = now()
    where profile_id = auth.uid() and business_id = p_business_id and ended_at is null;
  insert into public.support_sessions (profile_id, business_id, reason, expires_at)
    values (auth.uid(), p_business_id, left(v_reason, 300), v_expires);

  -- El comercio no puede leer los perfiles de la plataforma: el nombre va en el registro.
  perform private.audit(p_business_id, 'support.view_started', 'business', p_business_id::text,
    jsonb_build_object('reason', left(v_reason, 300), 'minutes', v_minutes,
      'by', (select full_name from public.profiles where id = auth.uid())));
  return v_expires;
end;
$$;

create or replace function public.end_support_session(p_business_id uuid)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.is_platform_reader() then raise exception 'FORBIDDEN'; end if;
  update public.support_sessions set ended_at = now()
    where profile_id = auth.uid() and business_id = p_business_id and ended_at is null and expires_at > now();
  if found then
    perform private.audit(p_business_id, 'support.view_ended', 'business', p_business_id::text,
      jsonb_build_object('by', (select full_name from public.profiles where id = auth.uid())));
  end if;
end;
$$;

revoke all on function public.start_support_session(uuid, text, integer) from public, anon;
revoke all on function public.end_support_session(uuid) from public, anon;
grant execute on function public.start_support_session(uuid, text, integer) to authenticated;
grant execute on function public.end_support_session(uuid) to authenticated;

-- ---------- Lectura durante la sesión (solo SELECT) ----------
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists cards_read on public.loyalty_cards;
create policy cards_read on public.loyalty_cards for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists redemptions_read on public.redemptions;
create policy redemptions_read on public.redemptions for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists promotions_read on public.promotions;
create policy promotions_read on public.promotions for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select to authenticated
  using (private.is_member(business_id) or private.has_support_access(business_id));

drop policy if exists customer_contacts_read on public.customer_contacts;
create policy customer_contacts_read on public.customer_contacts for select to authenticated
  using (private.has_role(business_id, '{owner,admin}') or private.has_support_access(business_id));

drop policy if exists wallet_notifications_read on public.wallet_notifications;
create policy wallet_notifications_read on public.wallet_notifications for select to authenticated
  using (private.has_role(business_id, '{owner,admin}') or private.has_support_access(business_id));

-- >>> 20261101000022_sello_propio_y_letras.sql
-- =====================================================================
-- Etapa 22 · Sello propio y más tipografías para la tarjeta
--  * stampUrl: el comercio sube su propio sello. Misma regla que el logo y la foto:
--    vacío para quitarlo o una imagen de la carpeta del propio comercio en Storage.
--  * font: además de clásica (serif) y moderna (sans), elegante, manuscrita,
--    redondeada, impacto y geométrica.
--  * Solo cambia la validación de update_business_profile; nada más.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000023_visita_manual.sql
-- =====================================================================
-- Etapa 23 · Sumar visita a mano (respaldo cuando el NFC falla en caja)
--  * Cualquier miembro activo del comercio puede sumar la visita desde la ficha del cliente,
--    escribiendo el motivo (5 a 200 caracteres).
--  * Aplica las mismas reglas que cualquier visita (private.record_visit): tiempo mínimo
--    entre visitas, tarjeta bloqueada, comercio suspendido, promociones y premios.
--  * La visita queda con origen 'manual' y además una entrada en la auditoría con el motivo.
--    Se puede revertir como cualquier otra.
-- =====================================================================

alter table public.visits drop constraint if exists visits_source_check;
alter table public.visits add constraint visits_source_check check (source in ('staff', 'nfc', 'manual'));

create or replace function public.register_manual_visit(
  p_card_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_result   jsonb;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select business_id into v_business from public.loyalty_cards where id = p_card_id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_business) then raise exception 'FORBIDDEN'; end if;
  if length(v_reason) < 5 then raise exception 'REASON_REQUIRED'; end if;

  v_result := private.record_visit(p_card_id, p_idempotency_key, p_location_id, auth.uid(), 'manual', 0);

  perform private.audit(v_business, 'visit.manual', 'loyalty_card', p_card_id::text,
    jsonb_build_object('reason', left(v_reason, 200), 'visit_id', v_result ->> 'visit_id'));
  return v_result;
end;
$$;

revoke all on function public.register_manual_visit(uuid, text, text, uuid) from public, anon;
grant execute on function public.register_manual_visit(uuid, text, text, uuid) to authenticated;

-- >>> 20261101000024_nombre_aparte.sql
-- =====================================================================
-- Etapa 24 · Nombre aparte para los avisos
--  * La inscripción pide Nombre y Apellido por separado; el servidor los guarda con
--    mayúscula inicial (full_name = «Nombre Apellido») y el nombre en customers.first_name.
--  * Los avisos ({nombre}) usan first_name: «María José», no solo «María».
--    Si falta (clientes anteriores), siguen usando la primera palabra del nombre completo.
--  * Al eliminar los datos personales de un cliente también se borra su nombre.
-- =====================================================================

alter table public.customers add column if not exists first_name text
  check (first_name is null or length(btrim(first_name)) between 1 and 60);

-- Clientes ya inscritos: la primera palabra del nombre completo.
update public.customers set first_name = split_part(btrim(full_name), ' ', 1)
  where first_name is null and anonymized_at is null and btrim(coalesce(full_name, '')) <> '';

-- Cualquier inserción sin nombre aparte (semillas, otras rutas) toma la primera palabra;
-- al anonimizar se borra.
create or replace function private.customer_first_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.anonymized_at is not null then
    new.first_name := null;
  elsif tg_op = 'UPDATE' and new.full_name is distinct from old.full_name
        and new.first_name is not distinct from old.first_name then
    -- Corrigieron el nombre completo sin tocar el nombre aparte: se vuelve a tomar la primera palabra.
    new.first_name := nullif(split_part(btrim(coalesce(new.full_name, '')), ' ', 1), '');
  elsif new.first_name is null or btrim(new.first_name) = '' then
    new.first_name := nullif(split_part(btrim(coalesce(new.full_name, '')), ' ', 1), '');
  end if;
  return new;
end;
$$;

drop trigger if exists customers_first_name on public.customers;
create trigger customers_first_name before insert or update of full_name, first_name, anonymized_at on public.customers
  for each row execute function private.customer_first_name();

-- ---------- {nombre} con el nombre aparte ----------
create or replace function public.queue_wallet_campaign(p_business_id uuid, p_customer_ids uuid[], p_title text, p_body text)
returns table (notification_id uuid, public_token text, title text, body text)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_ref text := 'campaign:' || gen_random_uuid()::text;
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 40
     or p_body is null or length(trim(p_body)) not between 1 and 240 then
    raise exception 'INVALID_WALLET_MESSAGE';
  end if;
  if coalesce(array_length(p_customer_ids, 1), 0) not between 1 and 2000 then raise exception 'INVALID_WALLET_MESSAGE'; end if;
  if exists (select 1 from public.businesses where id = p_business_id and status = 'suspended') then
    raise exception 'BUSINESS_SUSPENDED';
  end if;

  return query
  with eligible as (
    select c.id as card_id, c.public_token as token, cu.full_name, cu.first_name
    from public.customers cu
    join public.loyalty_cards c on c.customer_id = cu.id and c.business_id = cu.business_id
    where cu.business_id = p_business_id
      and cu.id = any (p_customer_ids)
      and cu.marketing_consent
      and cu.anonymized_at is null
      and c.status <> 'blocked'
      and not exists (select 1 from public.wallet_notifications n
                      where n.card_id = c.id and n.kind = 'campaign' and n.created_at > now() - interval '7 days')
  ), ins as (
    insert into public.wallet_notifications (business_id, card_id, kind, ref, title, body, staff_id)
    select p_business_id, e.card_id, 'campaign', v_ref, trim(p_title),
           left(replace(trim(p_body), '{nombre}', coalesce(nullif(btrim(e.first_name), ''), split_part(trim(e.full_name), ' ', 1))), 300), auth.uid()
    from eligible e
    on conflict (card_id, ref) do nothing
    returning id, card_id, wallet_notifications.title, wallet_notifications.body
  )
  select ins.id, e.token, ins.title, ins.body from ins join eligible e on e.card_id = ins.card_id;

  perform private.audit(p_business_id, 'wallet.campaign_queued', 'business', p_business_id::text,
                        jsonb_build_object('ref', v_ref, 'title', trim(p_title)));
end;
$$;

create or replace function public.wallet_daily_candidates(p_now timestamptz default now())
returns table (business_id uuid, card_id uuid, public_token text, kind text, ref text,
               first_name text, business_name text, current_stamps integer, stamps_required integer, reward_name text)
language sql
stable security definer
set search_path = ''
as $$
  with base as (
    select b.id as business_id, b.name as business_name, b.wallet_notifications as s,
           (p_now at time zone b.timezone) as local_now,
           c.id as card_id, c.public_token, c.current_stamps, c.last_visit_at,
           cu.full_name, cu.first_name, cu.birth_month, cu.birth_day,
           p.stamps_required, p.reward_name
    from public.businesses b
    join public.loyalty_cards c on c.business_id = b.id
    join public.customers cu on cu.id = c.customer_id
    join public.loyalty_programs p on p.id = c.program_id
    where b.status <> 'suspended'
      and c.status <> 'blocked'
      and cu.marketing_consent
      and cu.anonymized_at is null
  )
  select business_id, card_id, public_token, 'birthday', 'birthday:' || extract(year from local_now)::int,
         coalesce(nullif(btrim(first_name), ''), split_part(trim(full_name), ' ', 1)), business_name, current_stamps, stamps_required, reward_name
  from base
  where (s ->> 'birthday')::boolean
    and birth_month = extract(month from local_now)::int
    and coalesce(birth_day, 1) = extract(day from local_now)::int
  union all
  select business_id, card_id, public_token, 'winback', 'winback:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         coalesce(nullif(btrim(first_name), ''), split_part(trim(full_name), ' ', 1)), business_name, current_stamps, stamps_required, reward_name
  from base
  where (s ->> 'winback')::boolean
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => (s ->> 'winbackDays')::int)
    -- Solo quienes se enfriaron hace poco: al activar el aviso no se escribe a clientes de hace años.
    and last_visit_at > p_now - make_interval(days => (s ->> 'winbackDays')::int + 30);
$$;

-- >>> 20261101000025_sede_ubicacion.sql
-- =====================================================================
-- Etapa 25 · Ubicación de cada sede (aviso de cercanía en la billetera)
--  * Cada sede puede guardar su latitud y longitud. Con ellas, el pase de Apple Wallet
--    y el programa de Google Wallet llevan la ubicación del local: el celular del
--    cliente muestra la tarjeta (iPhone) o un aviso (Android) al estar cerca.
--  * Lazo no recibe ni guarda la ubicación del cliente: el cálculo lo hace su celular.
--  * Van las dos o ninguna; sin ellas la sede no da aviso de cercanía.
--  * Las políticas de la tabla no cambian (propietario y administrador editan).
-- =====================================================================

alter table public.locations
  add column if not exists latitude  double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180);

alter table public.locations drop constraint if exists locations_coords_pair;
alter table public.locations add constraint locations_coords_pair
  check ((latitude is null) = (longitude is null));

-- >>> 20261101000026_mensaje_cercania.sql
-- =====================================================================
-- Etapa 26 · Mensaje de cercanía editable
--  * El comercio escribe el texto que el iPhone muestra en la pantalla bloqueada
--    cuando el cliente está cerca de una sede (avisos automáticos → «Cerca del local»).
--  * Se guarda en businesses.wallet_notifications.nearbyText (opcional: sin él se usa
--    el texto por defecto). Entre 5 y 120 caracteres.
--  * Admite {nombre}, {comercio} y {progreso}; se reemplazan en cada pase.
-- =====================================================================

create or replace function private.valid_wallet_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k
                    where k not in ('stamp', 'near', 'reward', 'birthday', 'winback', 'winbackDays', 'nearbyText'))
    and jsonb_typeof(s -> 'stamp') = 'boolean'
    and jsonb_typeof(s -> 'near') = 'boolean'
    and jsonb_typeof(s -> 'reward') = 'boolean'
    and jsonb_typeof(s -> 'birthday') = 'boolean'
    and jsonb_typeof(s -> 'winback') = 'boolean'
    and jsonb_typeof(s -> 'winbackDays') = 'number'
    and (s ->> 'winbackDays') ~ '^[0-9]+$'
    and (s ->> 'winbackDays')::int between 14 and 180
    and (not (s ? 'nearbyText')
         or (jsonb_typeof(s -> 'nearbyText') = 'string'
             and length(btrim(s ->> 'nearbyText')) between 5 and 120));
$$;

-- >>> 20261101000027_estilo_tarjeta.sql
-- =====================================================================
-- Etapa 27 · Estilos premium de la tarjeta
--  * cardStyle: clásico (por defecto), noche y oro, cristal o negro mate. Lo elige
--    el comercio en «Tarjeta, QR y NFC»; cambia la tarjeta web y los pases de
--    Apple y Google Wallet.
--  * Solo cambia la validación de update_business_profile; nada más.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000027_superadmin_edita_comercio.sql
-- =====================================================================
-- Etapa 27 · Entrar y editar un comercio (solo superadministrador)
--  * La sesión de soporte (Etapa 21) tiene ahora un modo: «read» (ver) o «edit» (ver y editar).
--  * Solo un superadministrador activo puede abrir el modo «edit». Soporte sigue en solo lectura.
--  * Durante una sesión «edit» abierta, el superadministrador cuenta como propietario del comercio
--    en las funciones de permisos (is_member, has_role, can_redeem). Así se reutilizan TODAS las
--    reglas existentes (RLS y funciones) sin duplicarlas.
--  * Igual que en solo lectura: exige motivo, dura de 15 minutos a 2 horas, deja de valer si la
--    cuenta se suspende, y la entrada, la salida y cada cambio quedan en la auditoría DEL COMERCIO
--    con el nombre de quien los hizo.
-- =====================================================================

alter table public.support_sessions
  add column if not exists mode text not null default 'read' check (mode in ('read', 'edit'));

-- ¿Tiene el usuario una sesión de EDICIÓN abierta en este comercio? (solo superadministrador activo)
create or replace function private.has_edit_access(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_superadmin() and exists (
    select 1 from public.support_sessions s
    where s.profile_id = auth.uid() and s.business_id = p_business and s.mode = 'edit'
      and s.ended_at is null and s.expires_at > now()
  );
$$;
revoke all on function private.has_edit_access(uuid) from public;
grant execute on function private.has_edit_access(uuid) to authenticated;

-- ---------- Funciones de permisos: la sesión de edición cuenta como propietario ----------
create or replace function private.is_member(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business and m.profile_id = auth.uid() and m.active and p.suspended_at is null
  ) or private.has_edit_access(p_business);
$$;

create or replace function private.has_role(p_business uuid, p_roles public.business_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business and m.profile_id = auth.uid() and m.active and m.role = any (p_roles)
      and p.suspended_at is null
  ) or private.has_edit_access(p_business);
$$;

create or replace function private.can_redeem(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business and m.profile_id = auth.uid() and m.active
      and (m.role in ('owner', 'admin') or m.can_redeem) and p.suspended_at is null
  ) or private.has_edit_access(p_business);
$$;

-- ---------- Abrir y cerrar la sesión, ahora con modo ----------
drop function if exists public.start_support_session(uuid, text, integer);
create or replace function public.start_support_session(
  p_business_id uuid, p_reason text, p_minutes integer default 60, p_mode text default 'read'
)
returns timestamptz
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_minutes integer := least(greatest(coalesce(p_minutes, 60), 15), 120);
  v_expires timestamptz := now() + make_interval(mins => v_minutes);
  v_mode text := coalesce(p_mode, 'read');
  v_name text;
begin
  if not private.is_platform_reader() then raise exception 'FORBIDDEN'; end if;
  if v_mode not in ('read', 'edit') then raise exception 'INVALID_INPUT'; end if;
  -- Editar es solo del superadministrador; Soporte nunca cambia nada.
  if v_mode = 'edit' and not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if length(v_reason) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select name into v_name from public.businesses where id = p_business_id;
  if v_name is null then raise exception 'NOT_FOUND'; end if;

  -- Una sola sesión abierta por persona y comercio.
  update public.support_sessions set ended_at = now()
    where profile_id = auth.uid() and business_id = p_business_id and ended_at is null;
  insert into public.support_sessions (profile_id, business_id, reason, expires_at, mode)
    values (auth.uid(), p_business_id, left(v_reason, 300), v_expires, v_mode);

  -- El comercio no puede leer los perfiles de la plataforma: el nombre va en el registro.
  perform private.audit(p_business_id,
    case when v_mode = 'edit' then 'support.edit_started' else 'support.view_started' end,
    'business', p_business_id::text,
    jsonb_build_object('reason', left(v_reason, 300), 'minutes', v_minutes,
      'by', (select full_name from public.profiles where id = auth.uid())));
  return v_expires;
end;
$$;

create or replace function public.end_support_session(p_business_id uuid)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_mode text;
begin
  if not private.is_platform_reader() then raise exception 'FORBIDDEN'; end if;
  update public.support_sessions set ended_at = now()
    where profile_id = auth.uid() and business_id = p_business_id and ended_at is null and expires_at > now()
    returning mode into v_mode;
  if v_mode is not null then
    perform private.audit(p_business_id,
      case when v_mode = 'edit' then 'support.edit_ended' else 'support.view_ended' end,
      'business', p_business_id::text,
      jsonb_build_object('by', (select full_name from public.profiles where id = auth.uid())));
  end if;
end;
$$;

revoke all on function public.start_support_session(uuid, text, integer, text) from public, anon;
grant execute on function public.start_support_session(uuid, text, integer, text) to authenticated;

-- >>> 20261101000028_estilo_marfil.sql
-- =====================================================================
-- Etapa 28 · Estilo «Marfil y oro» de la tarjeta
--  * cardStyle admite además 'marfil': fondo marfil, letras finas y detalles dorados.
--  * Solo cambia la validación de update_business_profile; nada más.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro', 'marfil') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000029_reverso_pase.sql
-- =====================================================================
-- Etapa 29 · Reverso del pase en la billetera
--  * El comercio agrega datos que el cliente ve al reverso del pase (Apple)
--    y en los enlaces del pase (Google): WhatsApp, Instagram, sitio web y horario.
--  * Se guardan en businesses.pass_info (jsonb). Todo es opcional.
--  * La dirección sale de los ajustes del comercio y de sus sedes; no se repite aquí.
--  * Solo propietario y administrador los cambian (update_pass_info).
-- =====================================================================

create or replace function private.valid_pass_info(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k where k not in ('whatsapp', 'instagram', 'website', 'hours'))
    and (not (s ? 'whatsapp') or (jsonb_typeof(s -> 'whatsapp') = 'string' and (s ->> 'whatsapp') ~ '^\+?[0-9]{7,15}$'))
    and (not (s ? 'instagram') or (jsonb_typeof(s -> 'instagram') = 'string' and (s ->> 'instagram') ~ '^[A-Za-z0-9._]{1,30}$'))
    and (not (s ? 'website') or (jsonb_typeof(s -> 'website') = 'string' and (s ->> 'website') ~ '^https://[^\s<>"]{3,200}$'))
    and (not (s ? 'hours') or (jsonb_typeof(s -> 'hours') = 'string' and length(btrim(s ->> 'hours')) between 3 and 300));
$$;

alter table public.businesses
  add column if not exists pass_info jsonb not null default '{}'::jsonb;
alter table public.businesses drop constraint if exists businesses_pass_info_valid;
alter table public.businesses add constraint businesses_pass_info_valid check (private.valid_pass_info(pass_info));

create or replace function public.update_pass_info(p_business_id uuid, p_info jsonb)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then raise exception 'FORBIDDEN'; end if;
  if p_info is null or not private.valid_pass_info(p_info) then raise exception 'INVALID_PASS_INFO'; end if;
  update public.businesses set pass_info = p_info where id = p_business_id;
  perform private.audit(p_business_id, 'wallet.pass_info_updated', 'business', p_business_id::text, p_info);
end;
$$;

revoke all on function public.update_pass_info(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_pass_info(uuid, jsonb) to authenticated;

-- >>> 20261101000030_qr_tarjeta.sql
-- =====================================================================
-- Etapa 30 · La tarjeta web es igual al pase de Wallet («el hilo»)
--  * branding admite además 'passQr' (verdadero o falso): el comercio decide si la tarjeta
--    y el pase de Wallet llevan código QR. Sin definir, se muestra.
--  * Solo cambia la validación de update_business_profile; nada más. No toca datos.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro', 'marfil') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'passQr' then
        -- Código QR en la tarjeta y en el pase: solo verdadero o falso.
        if jsonb_typeof(p_branding -> k) is distinct from 'boolean' then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000031_eliminar_comercio_con_sedes.sql
-- =====================================================================
-- Eliminar comercio: fallaba en comercios reales.
-- Las visitas apuntan a su sede y a su promoción, y las recompensas a su visita,
-- sin borrado en cascada. Al eliminar el comercio, la base borraba primero las sedes
-- o las promociones y encontraba visitas que todavía las usaban: error y no borraba nada.
-- Ahora se borra primero el historial de ese comercio (canjes, recompensas, visitas),
-- en ese orden, y después el comercio con todo lo demás.
-- Sigue siendo solo para superadministradores, con el identificador escrito y con auditoría.
-- =====================================================================
create or replace function public.admin_delete_business(p_business_id uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.businesses;
begin
  if not private.is_superadmin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_b from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_confirm_slug is distinct from v_b.slug then
    raise exception 'CONFIRMATION_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata)
  values (null, auth.uid(), 'platform.business_deleted', 'business', v_b.id::text,
          jsonb_build_object('slug', v_b.slug, 'name', v_b.name, 'plan', v_b.plan_id));

  perform set_config('lazo.eliminando_comercio', v_b.id::text, true);
  -- Primero el historial, de lo que depende a lo dependido.
  delete from public.redemptions where business_id = v_b.id;
  delete from public.rewards where business_id = v_b.id;
  delete from public.visits where business_id = v_b.id;
  delete from public.businesses where id = v_b.id;
  perform set_config('lazo.eliminando_comercio', '', true);
end;
$$;
revoke all on function public.admin_delete_business(uuid, text) from public, anon;
grant execute on function public.admin_delete_business(uuid, text) to authenticated;

-- >>> 20261101000032_sello_cafe.sql
-- =====================================================================
-- Sello de café: el icono 'coffee' para cafeterías (primer cliente: un bistró y café).
--  * Solo cambia la lista de iconos permitidos en update_business_profile; nada más.
--    No toca datos.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors', 'coffee') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro', 'marfil') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'passQr' then
        -- Código QR en la tarjeta y en el pase: solo verdadero o falso.
        if jsonb_typeof(p_branding -> k) is distinct from 'boolean' then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000033_ilustracion_franja.sql
-- =====================================================================
-- Ilustración de la franja: el comercio puede subir un dibujo de su marca (su mascota,
-- su producto) que va de fondo en la franja de la tarjeta y del pase, en lugar de la inicial.
--  * branding admite 'illustrationUrl', con la misma regla que el logo y el sello:
--    vacío = quitarla; si no, solo una imagen de la carpeta del propio comercio en Storage.
--  * Solo cambia la validación de update_business_profile; nada más. No toca datos.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl', 'illustrationUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors', 'coffee') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro', 'marfil') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'passQr' then
        -- Código QR en la tarjeta y en el pase: solo verdadero o falso.
        if jsonb_typeof(p_branding -> k) is distinct from 'boolean' then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000034_codigo_barras.sql
-- =====================================================================
-- Código de barras de la tarjeta: cada tarjeta tiene un número de 12 dígitos para escanearlo
-- con la cámara del panel (o escribirlo a mano). No es el enlace de la tarjeta: con una foto
-- del código no se abre nada; solo el equipo del comercio, con sesión, lo convierte en visita.
--  * loyalty_cards.scan_code: 12 dígitos, único, se crea solo con cada tarjeta nueva.
--  * Las tarjetas que ya existen reciben el suyo.
--  * get_public_card devuelve 'scan_code' (para dibujarlo en la tarjeta y en el pase).
-- =====================================================================

create function private.generate_scan_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad((floor(random() * 1e12))::bigint::text, 12, '0');
$$;
revoke all on function private.generate_scan_code() from public, anon, authenticated;

alter table public.loyalty_cards add column scan_code text;

-- Las tarjetas existentes reciben su código, sin repetir.
do $$
declare
  r record;
  v text;
begin
  for r in select id from public.loyalty_cards where scan_code is null loop
    loop
      v := private.generate_scan_code();
      exit when not exists (select 1 from public.loyalty_cards where scan_code = v);
    end loop;
    update public.loyalty_cards set scan_code = v where id = r.id;
  end loop;
end
$$;

alter table public.loyalty_cards
  alter column scan_code set default private.generate_scan_code(),
  alter column scan_code set not null,
  add constraint loyalty_cards_scan_code_format check (scan_code ~ '^[0-9]{12}$');
create unique index loyalty_cards_scan_code_key on public.loyalty_cards (scan_code);

create or replace function public.get_public_card(p_token text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'token', c.public_token,
    'scan_code', c.scan_code,
    'status', c.status,
    'current_stamps', c.current_stamps,
    'total_visits', c.total_visits,
    'member_since', cu.created_at,
    'customer_name', cu.full_name,
    'marketing_consent', cu.marketing_consent,
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
    and b.status <> 'suspended'
    and cu.anonymized_at is null;
$$;

-- >>> 20261101000035_toque_por_celular.sql
-- =====================================================================
-- Toque NFC sumando el sello solo con el celular, ahora dentro de Postgres.
-- Antes la app buscaba el número ANTES de comprobar la etiqueta y respondía distinto si existía:
-- desde cualquier lugar se podía averiguar si un celular era cliente de un comercio (Ley 1581).
-- Ahora:
--  * Primero se comprueba la etiqueta (comercio activo, NFC encendido y secreto correcto). Si algo
--    falla, el error es siempre INVALID_TAG, sin mirar el número.
--  * Límite de intentos guardado en la base (no en la memoria del servidor): por conexión (HMAC de
--    la IP, nunca la IP) y por comercio. Los intentos fallidos también cuentan.
--  * Número que no existe, tarjeta bloqueada o datos borrados: la misma respuesta (PHONE_NOT_FOUND).
--  * Solo la service_role (el servidor de la app) puede llamarla.
-- =====================================================================

create table private.nfc_phone_attempts (
  client_key  text not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index nfc_phone_attempts_key_idx on private.nfc_phone_attempts (client_key, created_at);
create index nfc_phone_attempts_business_idx on private.nfc_phone_attempts (business_id, created_at);
create index nfc_phone_attempts_created_idx on private.nfc_phone_attempts (created_at);
-- Sin políticas: nadie la lee por la API; solo la función (dueña de la tabla) escribe y cuenta.
alter table private.nfc_phone_attempts enable row level security;

create function public.register_nfc_visit_by_phone(
  p_slug text,
  p_secret text,
  p_phone_e164 text,
  p_idempotency_key text,
  p_client_key text
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_nfc      private.business_nfc;
  v_token    text;
begin
  -- 1. La etiqueta. Cualquier falla da el mismo error y no se mira el número.
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found or v_business.status = 'suspended' then raise exception 'INVALID_TAG'; end if;
  select * into v_nfc from private.business_nfc where business_id = v_business.id;
  if not found or not v_nfc.enabled or p_secret is null or p_secret <> v_nfc.secret then
    raise exception 'INVALID_TAG';
  end if;

  -- 2. Límite de intentos (los fallidos también cuentan: por eso no se lanza error al no encontrar).
  delete from private.nfc_phone_attempts where created_at < now() - interval '1 day';
  if (select count(*) from private.nfc_phone_attempts
      where client_key = coalesce(p_client_key, '') and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from private.nfc_phone_attempts
         where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into private.nfc_phone_attempts (client_key, business_id) values (coalesce(p_client_key, ''), v_business.id);

  -- 3. El número. No existe, bloqueada o datos borrados: misma respuesta.
  select c.public_token into v_token
  from public.customers cu
  join public.loyalty_cards c on c.customer_id = cu.id
  where cu.business_id = v_business.id
    and cu.phone_e164 = p_phone_e164
    and cu.anonymized_at is null
    and c.status <> 'blocked'
  order by c.created_at desc
  limit 1;
  if v_token is null then
    return jsonb_build_object('error', 'PHONE_NOT_FOUND');
  end if;

  -- 4. La visita, con las reglas de siempre (tiempo mínimo, promociones, premios).
  return public.register_nfc_visit(p_slug, p_secret, v_token, p_idempotency_key);
end;
$$;

revoke all on function public.register_nfc_visit_by_phone(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_nfc_visit_by_phone(text, text, text, text, text) to service_role;

-- >>> 20261101000036_control_cobros.sql
-- =====================================================================
-- Control de cobros a los comercios (sin pago en línea todavía).
--  * Cada comercio tiene una fecha «pagado hasta». Al crearlo, es un mes después (el mes gratis).
--  * El superadministrador registra cada pago (transferencia, efectivo…): se guarda en el historial
--    y la fecha avanza los meses pagados.
--  * También puede corregir la fecha a mano, con motivo. Todo queda en la auditoría.
--  * Solo el equipo de la plataforma (superadministrador o soporte) ve esta información. El comercio no.
--  * Nada se suspende solo: el panel muestra los vencidos y la persona decide.
-- =====================================================================

create table public.business_billing (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  paid_until  date not null,
  updated_at  timestamptz not null default now()
);
create trigger business_billing_updated_at before update on public.business_billing
  for each row execute function private.touch_updated_at();

create table public.business_payments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount      integer not null check (amount between 0 and 100000000),
  paid_on     date not null,
  months      integer not null check (months between 1 and 12),
  paid_until  date not null,
  note        text check (note is null or length(note) <= 200),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index business_payments_business_idx on public.business_payments (business_id, created_at desc);

alter table public.business_billing enable row level security;
alter table public.business_payments enable row level security;
create policy business_billing_read on public.business_billing for select to authenticated using (private.is_platform_reader());
create policy business_payments_read on public.business_payments for select to authenticated using (private.is_platform_reader());
revoke all on public.business_billing, public.business_payments from anon, authenticated;
grant select on public.business_billing, public.business_payments to authenticated;

-- Comercios existentes: un mes después de su alta. Se corrige a mano en el panel si no coincide.
insert into public.business_billing (business_id, paid_until)
select id, (created_at at time zone 'America/Bogota')::date + interval '1 month'
from public.businesses
on conflict (business_id) do nothing;

-- Comercio nuevo: el primer mes es gratis.
create function private.create_business_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_billing (business_id, paid_until)
  values (new.id, (now() at time zone 'America/Bogota')::date + interval '1 month')
  on conflict (business_id) do nothing;
  return new;
end;
$$;
create trigger businesses_billing after insert on public.businesses
  for each row execute function private.create_business_billing();

-- ---------- Registrar un pago ----------
-- La fecha avanza desde «pagado hasta» (no desde hoy): así el ciclo de cobro no se corre si pagan tarde.
create function public.register_business_payment(
  p_business_id uuid,
  p_amount integer,
  p_paid_on date,
  p_months integer,
  p_note text default null
)
returns date
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_antes date;
  v_hasta date;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_amount is null or p_amount < 0 or p_months is null or p_months not between 1 and 12 or p_paid_on is null then
    raise exception 'INVALID_INPUT';
  end if;
  select paid_until into v_antes from public.business_billing where business_id = p_business_id for update;
  if not found then
    if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
    v_antes := (now() at time zone 'America/Bogota')::date;
    insert into public.business_billing (business_id, paid_until) values (p_business_id, v_antes);
  end if;
  v_hasta := (v_antes + make_interval(months => p_months))::date;
  update public.business_billing set paid_until = v_hasta where business_id = p_business_id;
  insert into public.business_payments (business_id, amount, paid_on, months, paid_until, note, created_by)
  values (p_business_id, p_amount, p_paid_on, p_months, v_hasta, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  perform private.audit(p_business_id, 'billing.payment_registered', 'business', p_business_id::text,
                        jsonb_build_object('amount', p_amount, 'months', p_months, 'paid_on', p_paid_on, 'from', v_antes, 'to', v_hasta));
  return v_hasta;
end;
$$;

-- ---------- Corregir la fecha a mano ----------
create function public.set_business_paid_until(p_business_id uuid, p_paid_until date, p_reason text)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_antes date;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_paid_until is null or length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'INVALID_INPUT'; end if;
  if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
  select paid_until into v_antes from public.business_billing where business_id = p_business_id;
  insert into public.business_billing (business_id, paid_until) values (p_business_id, p_paid_until)
  on conflict (business_id) do update set paid_until = excluded.paid_until;
  perform private.audit(p_business_id, 'billing.paid_until_changed', 'business', p_business_id::text,
                        jsonb_build_object('from', v_antes, 'to', p_paid_until, 'reason', left(trim(p_reason), 200)));
end;
$$;

revoke all on function public.register_business_payment(uuid, integer, date, integer, text) from public, anon, authenticated;
grant execute on function public.register_business_payment(uuid, integer, date, integer, text) to authenticated;
revoke all on function public.set_business_paid_until(uuid, date, text) from public, anon, authenticated;
grant execute on function public.set_business_paid_until(uuid, date, text) to authenticated;

-- >>> 20261101000037_nfc_limite_diario_y_ubicacion.sql
-- =====================================================================
-- NFC: límite de sellos por día y, si el comercio quiere, exigir estar en el local.
-- El enlace de la etiqueta es fijo: quien lo guarde puede abrirlo desde su casa. Antes solo lo frenaba
-- el tiempo mínimo entre toques (2 horas por defecto): un sello cada 2 horas sin pisar el local.
--  * max_per_day: sellos por NFC que una tarjeta puede sumar en un día (día del comercio). Por defecto 1.
--  * require_location: el celular debe mandar su ubicación y estar a menos de radius_m metros de una
--    sede con ubicación. La ubicación se usa para comparar y NO se guarda.
--  * En el sello escribiendo el celular, la ubicación se comprueba ANTES de buscar el número: así nadie
--    lejos del local puede usar la respuesta para averiguar si un número es cliente.
--  * Reintentar un toque que ya se registró (misma clave) no choca con estos límites.
-- Las funciones nuevas aceptan los parámetros viejos (los nuevos tienen valor por defecto).
-- =====================================================================

alter table private.business_nfc
  add column if not exists max_per_day      integer not null default 1 check (max_per_day between 1 and 20),
  add column if not exists require_location boolean not null default false,
  add column if not exists radius_m         integer not null default 200 check (radius_m between 50 and 2000);

-- Distancia en metros entre dos puntos (fórmula del semiverseno).
create function private.metros_entre(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))));
$$;

-- ¿Tiene el comercio alguna sede activa con ubicación?
create function private.tiene_sede_con_ubicacion(p_business_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.locations where business_id = p_business_id and active and latitude is not null);
$$;

-- Comprueba la ubicación si el comercio la exige. Si el comercio se quedó sin sedes con ubicación,
-- no bloquea (no se puede comparar contra nada): el panel no deja activarlo en ese caso.
create function private.nfc_comprobar_ubicacion(p_nfc private.business_nfc, p_lat double precision, p_lng double precision)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_min double precision;
begin
  if not p_nfc.require_location or not private.tiene_sede_con_ubicacion(p_nfc.business_id) then return; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'LOCATION_REQUIRED';
  end if;
  select min(private.metros_entre(p_lat, p_lng, latitude, longitude)) into v_min
  from public.locations where business_id = p_nfc.business_id and active and latitude is not null;
  if v_min is null or v_min > p_nfc.radius_m then raise exception 'TOO_FAR'; end if;
end;
$$;

-- ---------- Registrar visita por toque NFC (solo el servidor) ----------
drop function public.register_nfc_visit(text, text, text, text);
create function public.register_nfc_visit(
  p_slug text,
  p_secret text,
  p_card_token text,
  p_idempotency_key text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_nfc      private.business_nfc;
  v_card     public.loyalty_cards;
  v_result   jsonb;
  v_hoy      integer;
begin
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  if v_business.status = 'suspended' then raise exception 'BUSINESS_SUSPENDED'; end if;

  select * into v_nfc from private.business_nfc where business_id = v_business.id;
  if not found or not v_nfc.enabled then raise exception 'NFC_DISABLED'; end if;
  if p_secret is null or p_secret <> v_nfc.secret then raise exception 'INVALID_TAG'; end if;

  select * into v_card from public.loyalty_cards
  where public_token = p_card_token and business_id = v_business.id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;

  -- Un reintento de un toque ya registrado sigue de largo: record_visit lo reconoce por su clave.
  if not exists (select 1 from public.visits where business_id = v_business.id and idempotency_key = p_idempotency_key) then
    perform private.nfc_comprobar_ubicacion(v_nfc, p_lat, p_lng);

    -- Sellos por NFC de hoy (día del comercio), sin contar los que se revirtieron.
    select count(*) into v_hoy
    from public.visits v
    where v.card_id = v_card.id and v.kind = 'visit' and v.source = 'nfc'
      and v.created_at >= (date_trunc('day', now() at time zone v_business.timezone) at time zone v_business.timezone)
      and not exists (select 1 from public.visits r where r.reverses_visit_id = v.id);
    if v_hoy >= v_nfc.max_per_day then raise exception 'NFC_DAILY_LIMIT'; end if;
  end if;

  v_result := private.record_visit(v_card.id, p_idempotency_key, null, null, 'nfc', v_nfc.min_minutes);
  return v_result || jsonb_build_object('card_id', v_card.id, 'business_id', v_business.id);
end;
$$;
revoke all on function public.register_nfc_visit(text, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.register_nfc_visit(text, text, text, text, double precision, double precision) to service_role;

-- ---------- Sello escribiendo el celular ----------
drop function public.register_nfc_visit_by_phone(text, text, text, text, text);
create function public.register_nfc_visit_by_phone(
  p_slug text,
  p_secret text,
  p_phone_e164 text,
  p_idempotency_key text,
  p_client_key text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_nfc      private.business_nfc;
  v_token    text;
begin
  -- 1. La etiqueta. Cualquier falla da el mismo error y no se mira el número.
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found or v_business.status = 'suspended' then raise exception 'INVALID_TAG'; end if;
  select * into v_nfc from private.business_nfc where business_id = v_business.id;
  if not found or not v_nfc.enabled or p_secret is null or p_secret <> v_nfc.secret then
    raise exception 'INVALID_TAG';
  end if;

  -- 2. La ubicación, antes de mirar el número: lejos del local no se aprende nada sobre ningún celular.
  perform private.nfc_comprobar_ubicacion(v_nfc, p_lat, p_lng);

  -- 3. Límite de intentos (los fallidos también cuentan: por eso no se lanza error al no encontrar).
  delete from private.nfc_phone_attempts where created_at < now() - interval '1 day';
  if (select count(*) from private.nfc_phone_attempts
      where client_key = coalesce(p_client_key, '') and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from private.nfc_phone_attempts
         where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into private.nfc_phone_attempts (client_key, business_id) values (coalesce(p_client_key, ''), v_business.id);

  -- 4. El número. No existe, bloqueada o datos borrados: misma respuesta.
  select c.public_token into v_token
  from public.customers cu
  join public.loyalty_cards c on c.customer_id = cu.id
  where cu.business_id = v_business.id
    and cu.phone_e164 = p_phone_e164
    and cu.anonymized_at is null
    and c.status <> 'blocked'
  order by c.created_at desc
  limit 1;
  if v_token is null then
    return jsonb_build_object('error', 'PHONE_NOT_FOUND');
  end if;

  -- 5. La visita, con las reglas de siempre (límite del día, tiempo mínimo, promociones, premios).
  return public.register_nfc_visit(p_slug, p_secret, v_token, p_idempotency_key, p_lat, p_lng);
end;
$$;
revoke all on function public.register_nfc_visit_by_phone(text, text, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.register_nfc_visit_by_phone(text, text, text, text, text, double precision, double precision) to service_role;

-- ---------- Ajustes de NFC en el panel ----------
create or replace function public.get_nfc_settings(p_business_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_nfc private.business_nfc;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  insert into private.business_nfc (business_id) values (p_business_id) on conflict (business_id) do nothing;
  select * into v_nfc from private.business_nfc where business_id = p_business_id;
  return jsonb_build_object('enabled', v_nfc.enabled, 'secret', v_nfc.secret, 'min_minutes', v_nfc.min_minutes,
                            'max_per_day', v_nfc.max_per_day, 'require_location', v_nfc.require_location,
                            'can_require_location', private.tiene_sede_con_ubicacion(p_business_id));
end;
$$;

drop function public.set_nfc_settings(uuid, boolean, integer, boolean);
create function public.set_nfc_settings(
  p_business_id uuid,
  p_enabled boolean,
  p_min_minutes integer,
  p_rotate boolean default false,
  p_max_per_day integer default null,
  p_require_location boolean default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_nfc private.business_nfc;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_min_minutes is null or p_min_minutes not between 0 and 1440 then raise exception 'INVALID_NFC_SETTINGS'; end if;
  if p_max_per_day is not null and p_max_per_day not between 1 and 20 then raise exception 'INVALID_NFC_SETTINGS'; end if;
  if coalesce(p_require_location, false) and not private.tiene_sede_con_ubicacion(p_business_id) then
    raise exception 'NFC_NEEDS_LOCATION';
  end if;

  insert into private.business_nfc (business_id) values (p_business_id) on conflict (business_id) do nothing;
  update private.business_nfc
  set enabled          = coalesce(p_enabled, false),
      min_minutes      = p_min_minutes,
      max_per_day      = coalesce(p_max_per_day, max_per_day),
      require_location = coalesce(p_require_location, require_location),
      secret           = case when coalesce(p_rotate, false) then private.generate_public_token() else secret end,
      updated_at       = now()
  where business_id = p_business_id
  returning * into v_nfc;

  -- El secreto nunca va a la auditoría.
  perform private.audit(p_business_id, 'nfc.settings', 'business', p_business_id::text,
                        jsonb_build_object('enabled', v_nfc.enabled, 'min_minutes', v_nfc.min_minutes,
                                           'max_per_day', v_nfc.max_per_day, 'require_location', v_nfc.require_location,
                                           'secret_rotated', coalesce(p_rotate, false)));
  return jsonb_build_object('enabled', v_nfc.enabled, 'secret', v_nfc.secret, 'min_minutes', v_nfc.min_minutes,
                            'max_per_day', v_nfc.max_per_day, 'require_location', v_nfc.require_location,
                            'can_require_location', private.tiene_sede_con_ubicacion(p_business_id));
end;
$$;
revoke all on function public.set_nfc_settings(uuid, boolean, integer, boolean, integer, boolean) from public, anon, authenticated;
grant execute on function public.set_nfc_settings(uuid, boolean, integer, boolean, integer, boolean) to authenticated;
grant execute on function public.get_nfc_settings(uuid) to authenticated;

-- >>> 20261101000038_limites_planes.sql
-- Nuevos límites comerciales (21-nov-2026). Los precios y el tamaño del equipo no cambian.
-- Starter: 300 clientes y 1 sede. Pro: 1.000 clientes y sedes sin límite. Business sigue a la medida.
-- Solo amplía cupos: ningún comercio queda por encima de su límite con este cambio.
update public.plans
set max_customers = 300,
    features = array['1 programa', 'Hasta 300 clientes', '2 empleados', '1 sede']
where id = 'plan_starter';

update public.plans
set max_customers = 1000,
    max_locations = null,
    features = array['3 programas', 'Hasta 1.000 clientes', '10 empleados', 'Sedes ilimitadas']
where id = 'plan_pro';

-- >>> 20261101000039_segundo_mes_gratis.sql
-- =====================================================================
-- Control de cobros con la nueva oferta del plan Starter:
-- «pagas el primer mes y el segundo es gratis».
--  * Un comercio nuevo empieza sin meses pagados: «pagado hasta» es el día en que se crea
--    (aparece por cobrar hasta que pague el primer mes).
--  * Cada comercio nuevo queda con el mes gratis pendiente (business_billing.free_month_pending).
--    El primer pago que se le registre estando en el plan Starter suma, además de los meses pagados,
--    ese mes gratis, y lo marca como usado. Queda en el historial (free_months) y en la auditoría.
--  * Ese primer pago cuenta desde la fecha en que pagó si es posterior a «pagado hasta»:
--    así no pierde días por haber pagado unos días después de crearse.
--  * Los comercios que ya existían no cambian: ya tuvieron su mes gratis con la oferta anterior.
-- =====================================================================

alter table public.business_payments
  add column if not exists free_months integer not null default 0 check (free_months between 0 and 12);
-- Los existentes quedan en false: su mes gratis ya se dio al crearlos.
alter table public.business_billing
  add column if not exists free_month_pending boolean not null default false;

-- Comercio nuevo: sin meses pagados todavía.
create or replace function private.create_business_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_billing (business_id, paid_until, free_month_pending)
  values (new.id, (now() at time zone 'America/Bogota')::date, true)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

create or replace function public.register_business_payment(
  p_business_id uuid,
  p_amount integer,
  p_paid_on date,
  p_months integer,
  p_note text default null
)
returns date
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_antes date;
  v_desde date;
  v_hasta date;
  v_gratis integer := 0;
  v_pendiente boolean := false;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_amount is null or p_amount < 0 or p_months is null or p_months not between 1 and 12 or p_paid_on is null then
    raise exception 'INVALID_INPUT';
  end if;
  select paid_until, free_month_pending into v_antes, v_pendiente from public.business_billing where business_id = p_business_id for update;
  if not found then
    if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
    v_antes := (now() at time zone 'America/Bogota')::date;
    insert into public.business_billing (business_id, paid_until) values (p_business_id, v_antes);
  end if;

  -- Plan Starter con el mes gratis pendiente: este pago trae el segundo mes gratis.
  if coalesce(v_pendiente, false) and exists (select 1 from public.businesses where id = p_business_id and plan_id = 'plan_starter') then
    v_gratis := 1;
  end if;
  -- La fecha avanza desde «pagado hasta» (no desde hoy) para que el ciclo no se corra si pagan tarde;
  -- solo el primer pago de un comercio nuevo cuenta desde el día en que pagó, si es posterior.
  v_desde := case when coalesce(v_pendiente, false) then greatest(v_antes, p_paid_on) else v_antes end;
  v_hasta := (v_desde + make_interval(months => p_months + v_gratis))::date;

  -- El primer pago cierra la oferta: aunque no fuera Starter, ya no queda pendiente.
  update public.business_billing set paid_until = v_hasta, free_month_pending = false where business_id = p_business_id;
  insert into public.business_payments (business_id, amount, paid_on, months, free_months, paid_until, note, created_by)
  values (p_business_id, p_amount, p_paid_on, p_months, v_gratis, v_hasta, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  perform private.audit(p_business_id, 'billing.payment_registered', 'business', p_business_id::text,
                        jsonb_build_object('amount', p_amount, 'months', p_months, 'free_months', v_gratis,
                                           'paid_on', p_paid_on, 'from', v_antes, 'to', v_hasta));
  return v_hasta;
end;
$$;

revoke all on function public.register_business_payment(uuid, integer, date, integer, text) from public, anon, authenticated;
grant execute on function public.register_business_payment(uuid, integer, date, integer, text) to authenticated;

-- >>> 20261101000040_pagos_en_linea.sql
-- =====================================================================
-- Pago del plan en línea con Wompi (PSE, Nequi, tarjeta…).
--  * El dueño o administrador del comercio inicia el pago desde su panel: se crea una
--    «orden» (online_payments) con su referencia única, los meses y el valor según su plan.
--  * Wompi avisa al servidor cuando la transacción termina. El servidor verifica la firma del
--    aviso y llama a confirm_online_payment (solo con la clave del servidor): si quedó
--    APROBADA y el valor coincide, se registra el pago igual que si lo hiciera el
--    superadministrador (misma lógica, incluido el segundo mes gratis del Starter).
--  * Cada orden se aplica una sola vez, aunque Wompi repita el aviso.
--  * El comercio ve su fecha «pagado hasta» y sus órdenes; nunca el resto de cobros.
-- =====================================================================

-- ---------- La lógica de registrar un pago, compartida ----------
-- Antes vivía dentro de register_business_payment (migración 0039). Ahora la usan
-- el superadministrador (pago manual) y la confirmación de Wompi.
create or replace function private.apply_business_payment(
  p_business_id uuid,
  p_amount integer,
  p_paid_on date,
  p_months integer,
  p_note text,
  p_created_by uuid
)
returns date
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_antes date;
  v_desde date;
  v_hasta date;
  v_gratis integer := 0;
  v_pendiente boolean := false;
begin
  if p_amount is null or p_amount < 0 or p_months is null or p_months not between 1 and 12 or p_paid_on is null then
    raise exception 'INVALID_INPUT';
  end if;
  select paid_until, free_month_pending into v_antes, v_pendiente from public.business_billing where business_id = p_business_id for update;
  if not found then
    if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
    v_antes := (now() at time zone 'America/Bogota')::date;
    insert into public.business_billing (business_id, paid_until) values (p_business_id, v_antes);
  end if;

  -- Plan Starter con el mes gratis pendiente: este pago trae el segundo mes gratis.
  if coalesce(v_pendiente, false) and exists (select 1 from public.businesses where id = p_business_id and plan_id = 'plan_starter') then
    v_gratis := 1;
  end if;
  -- La fecha avanza desde «pagado hasta» (no desde hoy) para que el ciclo no se corra si pagan tarde;
  -- solo el primer pago de un comercio nuevo cuenta desde el día en que pagó, si es posterior.
  v_desde := case when coalesce(v_pendiente, false) then greatest(v_antes, p_paid_on) else v_antes end;
  v_hasta := (v_desde + make_interval(months => p_months + v_gratis))::date;

  update public.business_billing set paid_until = v_hasta, free_month_pending = false where business_id = p_business_id;
  insert into public.business_payments (business_id, amount, paid_on, months, free_months, paid_until, note, created_by)
  values (p_business_id, p_amount, p_paid_on, p_months, v_gratis, v_hasta, nullif(trim(coalesce(p_note, '')), ''), p_created_by);
  perform private.audit(p_business_id, 'billing.payment_registered', 'business', p_business_id::text,
                        jsonb_build_object('amount', p_amount, 'months', p_months, 'free_months', v_gratis,
                                           'paid_on', p_paid_on, 'from', v_antes, 'to', v_hasta,
                                           'note', nullif(trim(coalesce(p_note, '')), '')));
  return v_hasta;
end;
$$;
revoke all on function private.apply_business_payment(uuid, integer, date, integer, text, uuid) from public, anon, authenticated;

-- Pago manual del superadministrador: igual que antes, ahora sobre la lógica compartida.
create or replace function public.register_business_payment(
  p_business_id uuid,
  p_amount integer,
  p_paid_on date,
  p_months integer,
  p_note text default null
)
returns date
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  return private.apply_business_payment(p_business_id, p_amount, p_paid_on, p_months, p_note, auth.uid());
end;
$$;
revoke all on function public.register_business_payment(uuid, integer, date, integer, text) from public, anon, authenticated;
grant execute on function public.register_business_payment(uuid, integer, date, integer, text) to authenticated;

-- ---------- Órdenes de pago en línea ----------
create table if not exists public.online_payments (
  reference      text primary key check (reference ~ '^lazo-[a-z0-9-]{8,60}$'),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  months         integer not null check (months between 1 and 12),
  amount_cents   bigint not null check (amount_cents > 0),
  status         text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
  transaction_id text unique,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  applied_at     timestamptz
);
create index if not exists online_payments_business_idx on public.online_payments (business_id, created_at desc);
drop trigger if exists online_payments_updated_at on public.online_payments;
create trigger online_payments_updated_at before update on public.online_payments
  for each row execute function private.touch_updated_at();

alter table public.online_payments enable row level security;
drop policy if exists online_payments_read on public.online_payments;
create policy online_payments_read on public.online_payments for select to authenticated
  using (private.has_role(business_id, '{owner,admin}') or private.is_platform_reader());
revoke all on public.online_payments from anon, authenticated;
grant select on public.online_payments to authenticated;

-- El dueño (o administrador) inicia un pago: el valor lo pone la base de datos según el plan.
create or replace function public.start_online_payment(p_business_id uuid, p_months integer)
returns table (reference text, amount_cents bigint, months integer)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_precio integer;
  v_ref text;
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if p_months is null or p_months not between 1 and 12 then raise exception 'INVALID_INPUT'; end if;
  select p.price_monthly into v_precio
  from public.businesses b join public.plans p on p.id = b.plan_id
  where b.id = p_business_id;
  if v_precio is null or v_precio <= 0 then raise exception 'PLAN_WITHOUT_PRICE'; end if;
  v_ref := 'lazo-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.online_payments (reference, business_id, months, amount_cents, created_by)
  values (v_ref, p_business_id, p_months, v_precio::bigint * p_months * 100, auth.uid());
  perform private.audit(p_business_id, 'billing.online_payment_started', 'business', p_business_id::text,
                        jsonb_build_object('reference', v_ref, 'months', p_months, 'amount_cents', v_precio::bigint * p_months * 100));
  return query select v_ref, v_precio::bigint * p_months * 100, p_months;
end;
$$;
revoke all on function public.start_online_payment(uuid, integer) from public, anon, authenticated;
grant execute on function public.start_online_payment(uuid, integer) to authenticated;

-- Aviso de Wompi (ya verificado por el servidor). Solo con la clave del servidor.
-- Devuelve 'applied' (pago registrado ahora), 'already' (ya se había aplicado), 'updated'
-- (otro estado), 'unknown' (referencia que no existe) o 'mismatch' (el valor no coincide).
create or replace function public.confirm_online_payment(
  p_reference text,
  p_transaction_id text,
  p_status text,
  p_amount_cents bigint
)
returns text
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  o public.online_payments%rowtype;
  v_hasta date;
begin
  select * into o from public.online_payments where reference = p_reference for update;
  if not found then return 'unknown'; end if;
  if o.applied_at is not null then return 'already'; end if;
  if p_status not in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR') then raise exception 'INVALID_INPUT'; end if;

  if p_status = 'APPROVED' then
    if p_amount_cents is distinct from o.amount_cents then
      update public.online_payments set status = 'ERROR', transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
      perform private.audit(o.business_id, 'billing.online_payment_mismatch', 'business', o.business_id::text,
                            jsonb_build_object('reference', p_reference, 'expected', o.amount_cents, 'received', p_amount_cents, 'transaction', p_transaction_id));
      return 'mismatch';
    end if;
    v_hasta := private.apply_business_payment(
      o.business_id, (o.amount_cents / 100)::integer, (now() at time zone 'America/Bogota')::date, o.months,
      'Pago en línea Wompi · ' || coalesce(p_transaction_id, p_reference), o.created_by);
    update public.online_payments set status = 'APPROVED', transaction_id = p_transaction_id, applied_at = now() where reference = p_reference;
    return 'applied';
  end if;

  update public.online_payments set status = p_status, transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
  return 'updated';
end;
$$;
revoke all on function public.confirm_online_payment(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, text, text, bigint) to service_role;

-- Lo que el comercio ve de su cobro: fecha «pagado hasta», si tiene el mes gratis pendiente y el precio.
create or replace function public.my_billing(p_business_id uuid)
returns table (paid_until date, free_month_pending boolean, plan_id text, plan_name text, price_monthly integer)
language sql
stable security definer
set search_path = ''
as $$
  select bb.paid_until, bb.free_month_pending, p.id, p.name, p.price_monthly
  from public.businesses b
  join public.plans p on p.id = b.plan_id
  left join public.business_billing bb on bb.business_id = b.id
  where b.id = p_business_id
    and (private.has_role(p_business_id, '{owner,admin}') or private.is_platform_reader());
$$;
revoke all on function public.my_billing(uuid) from public, anon, authenticated;
grant execute on function public.my_billing(uuid) to authenticated;

-- >>> 20261101000041_pago_en_linea_cualquier_pasarela.sql
-- =====================================================================
-- Pago en línea con cualquier pasarela (Mercado Pago o Wompi).
--  * Solo cambia la nota con la que queda el pago en el historial de cobros:
--    «Pago en línea · <transacción>» (antes decía «Wompi»). La transacción ya indica la
--    pasarela: las de Mercado Pago empiezan por «mp-».
--  * Nada más cambia: sigue siendo solo para el servidor, una sola vez y con el valor exacto.
-- =====================================================================

create or replace function public.confirm_online_payment(
  p_reference text,
  p_transaction_id text,
  p_status text,
  p_amount_cents bigint
)
returns text
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  o public.online_payments%rowtype;
  v_hasta date;
begin
  select * into o from public.online_payments where reference = p_reference for update;
  if not found then return 'unknown'; end if;
  if o.applied_at is not null then return 'already'; end if;
  if p_status not in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR') then raise exception 'INVALID_INPUT'; end if;

  if p_status = 'APPROVED' then
    if p_amount_cents is distinct from o.amount_cents then
      update public.online_payments set status = 'ERROR', transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
      perform private.audit(o.business_id, 'billing.online_payment_mismatch', 'business', o.business_id::text,
                            jsonb_build_object('reference', p_reference, 'expected', o.amount_cents, 'received', p_amount_cents, 'transaction', p_transaction_id));
      return 'mismatch';
    end if;
    v_hasta := private.apply_business_payment(
      o.business_id, (o.amount_cents / 100)::integer, (now() at time zone 'America/Bogota')::date, o.months,
      'Pago en línea · ' || coalesce(p_transaction_id, p_reference), o.created_by);
    update public.online_payments set status = 'APPROVED', transaction_id = p_transaction_id, applied_at = now() where reference = p_reference;
    return 'applied';
  end if;

  update public.online_payments set status = p_status, transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
  return 'updated';
end;
$$;
revoke all on function public.confirm_online_payment(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, text, text, bigint) to service_role;

-- >>> 20261101000042_letra_propia.sql
-- =====================================================================
-- Letra propia del comercio: sube su tipografía (TTF, OTF o WOFF) y se usa en la tarjeta,
-- el pase de Wallet, la página de registro y el QR de inscripción.
--  * branding admite 'font' = 'propia', 'fontUrl' (archivo de su carpeta en Storage) y
--    'fontName' (cómo se llama, para mostrarlo en el panel).
--  * El almacenamiento de marca acepta archivos de letra y hasta 2 MB (las letras pesan más
--    que un logo).
--  * Solo cambian la validación de update_business_profile y el almacenamiento; no toca datos.
-- =====================================================================

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg', 'font/ttf', 'font/otf', 'font/woff']
where id = 'brand-assets';

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl', 'illustrationUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'fontUrl' then
        -- Letra propia: vacío = quitarla; si no, un archivo de letra (TTF, OTF o WOFF) de su carpeta.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+\.(ttf|otf|woff)$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'fontName' then
        -- Nombre de la letra para mostrar en el panel (sin saltos de línea ni comillas).
        if v is null or length(trim(v)) > 40 or v ~ '[\n\r"<>]' then raise exception 'INVALID_BRANDING'; end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors', 'coffee') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica', 'propia') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro', 'marfil') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'passQr' then
        -- Código QR en la tarjeta y en el pase: solo verdadero o falso.
        if jsonb_typeof(p_branding -> k) is distinct from 'boolean' then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

-- >>> 20261101000043_recordatorios.sql
-- =====================================================================
-- Recordatorios automáticos para que los clientes vuelvan.
--  * «Te falta poco»: a quien está a 1 o 2 sellos del premio (con al menos la mitad de la tarjeta
--    hecha) y lleva unos días sin venir
--    (almost = activo, almostDays = días sin venir, de 5 a 60; por defecto 10).
--  * «Te extrañamos» con mensaje propio del comercio (winbackText, opcional):
--    {nombre}, {comercio} y {progreso} se cambian al enviarlo.
--  * Nunca más de un recordatorio (campaña, te extrañamos o te falta poco) por cliente a la
--    semana: así no se cansa nadie.
--  * Igual que antes: solo a quien aceptó mensajes, con la tarjeta activa, y cada aviso se
--    registra una sola vez por ausencia (no se repite aunque el proceso corra otra vez).
-- =====================================================================

-- ---------- Ajustes: claves nuevas (opcionales: sin ellas se usan los valores por defecto) ----------
create or replace function private.valid_wallet_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k
                    where k not in ('stamp', 'near', 'reward', 'birthday', 'winback', 'winbackDays', 'nearbyText',
                                    'winbackText', 'almost', 'almostDays'))
    and jsonb_typeof(s -> 'stamp') = 'boolean'
    and jsonb_typeof(s -> 'near') = 'boolean'
    and jsonb_typeof(s -> 'reward') = 'boolean'
    and jsonb_typeof(s -> 'birthday') = 'boolean'
    and jsonb_typeof(s -> 'winback') = 'boolean'
    and jsonb_typeof(s -> 'winbackDays') = 'number'
    and (s ->> 'winbackDays') ~ '^[0-9]+$'
    and (s ->> 'winbackDays')::int between 14 and 180
    and (not (s ? 'nearbyText')
         or (jsonb_typeof(s -> 'nearbyText') = 'string'
             and length(btrim(s ->> 'nearbyText')) between 5 and 120))
    and (not (s ? 'winbackText')
         or (jsonb_typeof(s -> 'winbackText') = 'string'
             and length(btrim(s ->> 'winbackText')) between 5 and 200))
    and (not (s ? 'almost') or jsonb_typeof(s -> 'almost') = 'boolean')
    and (not (s ? 'almostDays')
         or (jsonb_typeof(s -> 'almostDays') = 'number'
             and (s ->> 'almostDays') ~ '^[0-9]+$'
             and (s ->> 'almostDays')::int between 5 and 60));
$$;

-- ---------- Registro de avisos: nuevo tipo «almost» (te falta poco) ----------
alter table public.wallet_notifications drop constraint if exists wallet_notifications_kind_check;
alter table public.wallet_notifications add constraint wallet_notifications_kind_check
  check (kind in ('stamp', 'near', 'reward', 'birthday', 'winback', 'almost', 'campaign'));

-- ---------- Candidatos del proceso diario ----------
-- Cambia lo que devuelve (se agrega el mensaje propio), por eso se borra y se crea de nuevo.
drop function if exists public.wallet_daily_candidates(timestamptz);
create function public.wallet_daily_candidates(p_now timestamptz default now())
returns table (business_id uuid, card_id uuid, public_token text, kind text, ref text,
               first_name text, business_name text, current_stamps integer, stamps_required integer, reward_name text,
               message text)
language sql
stable security definer
set search_path = ''
as $$
  with base as (
    select b.id as business_id, b.name as business_name, b.wallet_notifications as s,
           (p_now at time zone b.timezone) as local_now,
           c.id as card_id, c.public_token, c.current_stamps, c.last_visit_at,
           cu.full_name, cu.first_name, cu.birth_month, cu.birth_day,
           p.stamps_required, p.reward_name,
           -- ¿Ya recibió un recordatorio esta semana? (campaña, te extrañamos o te falta poco)
           exists (select 1 from public.wallet_notifications n
                   where n.card_id = c.id and n.kind in ('campaign', 'winback', 'almost')
                     and n.created_at > p_now - interval '7 days') as reciente
    from public.businesses b
    join public.loyalty_cards c on c.business_id = b.id
    join public.customers cu on cu.id = c.customer_id
    join public.loyalty_programs p on p.id = c.program_id
    where b.status <> 'suspended'
      and c.status <> 'blocked'
      and cu.marketing_consent
      and cu.anonymized_at is null
  ),
  dias as (
    select base.*,
           (s ->> 'winbackDays')::int as winback_days,
           coalesce((s ->> 'almostDays')::int, 10) as almost_days,
           coalesce((s ->> 'almost')::boolean, true) as almost_on,
           coalesce(split_part(trim(full_name), ' ', 1), '') as primer_nombre
    from base
  )
  select business_id, card_id, public_token, 'birthday', 'birthday:' || extract(year from local_now)::int,
         coalesce(nullif(btrim(first_name), ''), primer_nombre), business_name, current_stamps, stamps_required, reward_name,
         null::text
  from dias
  where (s ->> 'birthday')::boolean
    and birth_month = extract(month from local_now)::int
    and coalesce(birth_day, 1) = extract(day from local_now)::int
  union all
  select business_id, card_id, public_token, 'winback', 'winback:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         coalesce(nullif(btrim(first_name), ''), primer_nombre), business_name, current_stamps, stamps_required, reward_name,
         nullif(btrim(s ->> 'winbackText'), '')
  from dias
  where (s ->> 'winback')::boolean
    and not reciente
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => winback_days)
    -- Solo quienes se enfriaron hace poco: al activar el aviso no se escribe a clientes de hace años.
    and last_visit_at > p_now - make_interval(days => winback_days + 30)
  union all
  -- Te falta poco: a 1 o 2 sellos del premio y unos días sin venir (antes de «te extrañamos»).
  select business_id, card_id, public_token, 'almost', 'almost:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         coalesce(nullif(btrim(first_name), ''), primer_nombre), business_name, current_stamps, stamps_required, reward_name,
         null::text
  from dias
  where almost_on
    and not reciente
    and current_stamps > 0
    and stamps_required - current_stamps between 1 and 2
    and current_stamps * 2 >= stamps_required   -- y con al menos la mitad de la tarjeta hecha
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => almost_days)
    and last_visit_at > p_now - make_interval(days => almost_days + 30)
    -- Si ya toca «te extrañamos», ese tiene prioridad.
    and not ((s ->> 'winback')::boolean and last_visit_at < p_now - make_interval(days => winback_days));
$$;
revoke all on function public.wallet_daily_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_daily_candidates(timestamptz) to service_role;

-- >>> 20261101000044_demo.sql
-- =====================================================================
-- Demo para vender: un comercio marcado como «demo» (LAZO) deja que quien tiene su tarjeta se
-- sume un sello de prueba desde la tarjeta, sin empleado. Así el dueño de un negocio ve en su
-- propio celular cómo llega el sello y el aviso a la billetera.
--  * Solo en comercios con is_demo (se marca a mano; nadie lo puede cambiar desde el panel).
--  * Frenos: un sello cada 10 segundos por tarjeta y máximo 30 sellos de prueba al día.
--  * Los sellos de prueba quedan como visitas con origen 'demo' (se ven así en el historial).
--  * Solo la llama el servidor (service_role), con la tarjeta del enlace.
-- =====================================================================

alter table public.businesses add column if not exists is_demo boolean not null default false;
update public.businesses set is_demo = true where slug = 'lazo';

alter table public.visits drop constraint if exists visits_source_check;
alter table public.visits add constraint visits_source_check check (source in ('staff', 'nfc', 'manual', 'demo'));

-- record_visit: igual que en la migración 0015, salvo que la demo no usa el tiempo mínimo del programa.
create or replace function private.record_visit(
  p_card_id uuid,
  p_idempotency_key text,
  p_location_id uuid,
  p_staff uuid,
  p_source text,
  p_min_minutes integer
)
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
  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;

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

  -- Los sellos de prueba de la demo usan su propio freno (demo_add_stamp), no el del programa.
  if p_source <> 'demo'
     and v_card.last_visit_at is not null
     and greatest(v_program.min_minutes_between_visits, coalesce(p_min_minutes, 0)) > 0
     and v_card.last_visit_at > now() - make_interval(mins => greatest(v_program.min_minutes_between_visits, coalesce(p_min_minutes, 0))) then
    raise exception 'TOO_SOON';
  end if;

  -- Promoción vigente hoy (p. ej. doble sello): suma sellos extra en la misma visita.
  select * into v_promo from private.active_promotion(v_card.business_id);
  v_bonus := coalesce(v_promo.bonus_stamps, 0);

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key, bonus_stamps, promotion_id, location_id, source)
  values (v_card.business_id, v_card.id, 'visit', 1, p_staff, p_idempotency_key, v_bonus, v_promo.id, p_location_id, p_source)
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
                        jsonb_build_object('card_id', v_card.id, 'bonus_stamps', v_bonus, 'promotion_id', v_promo.id, 'source', p_source));
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


create or replace function public.demo_add_stamp(p_card_token text, p_idempotency_key text)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_card     public.loyalty_cards;
  v_business public.businesses;
  v_hoy      integer;
  v_result   jsonb;
begin
  select * into v_card from public.loyalty_cards where public_token = p_card_token;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  select * into v_business from public.businesses where id = v_card.business_id;
  if not v_business.is_demo then raise exception 'NOT_DEMO'; end if;

  -- Un reintento de la misma petición sigue de largo: record_visit lo reconoce por su clave.
  if not exists (select 1 from public.visits where business_id = v_business.id and idempotency_key = p_idempotency_key) then
    if exists (select 1 from public.visits where card_id = v_card.id and kind = 'visit' and created_at > now() - interval '10 seconds') then
      raise exception 'DEMO_TOO_FAST';
    end if;
    select count(*) into v_hoy from public.visits
    where card_id = v_card.id and kind = 'visit' and source = 'demo' and created_at > now() - interval '1 day';
    if v_hoy >= 30 then raise exception 'DEMO_DAILY_LIMIT'; end if;
  end if;

  v_result := private.record_visit(v_card.id, p_idempotency_key, null, null, 'demo', 0);
  return v_result || jsonb_build_object('card_id', v_card.id, 'business_id', v_business.id);
end;
$$;
revoke all on function public.demo_add_stamp(text, text) from public, anon, authenticated;
grant execute on function public.demo_add_stamp(text, text) to service_role;

-- >>> 20261101000045_eliminar_cliente_superadmin.sql
-- =====================================================================
-- Cupo de clientes y borrado de clientes.
--  * El comercio (propietario) puede eliminar los DATOS de un cliente (anonymize_customer): se borran
--    nombre, celular, correo y cumpleaños, y la tarjeta deja de funcionar. El registro queda y SIGUE
--    OCUPANDO CUPO del plan: así nadie borra clientes para hacerle espacio a otros.
--  * Solo el superadministrador puede eliminar un cliente por completo (admin_delete_customer):
--    se borran su tarjeta, visitas, premios, canjes y contactos, y se libera el cupo.
--  * El historial (visitas, canjes, contactos) sigue sin poderse borrar por ninguna otra vía.
-- =====================================================================

-- El bloqueo del historial admite, además del borrado de un comercio completo, el borrado de un
-- cliente completo hecho desde admin_delete_customer.
create or replace function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
  v_borrando text := current_setting('lazo.eliminando_comercio', true);
  v_cliente  text := current_setting('lazo.eliminando_cliente', true);
begin
  if tg_op = 'UPDATE' and actor_col is not null
     and (to_jsonb(new) ->> actor_col) is null
     and (to_jsonb(new) - actor_col) = (to_jsonb(old) - actor_col) then
    return new;
  end if;
  -- Borrado en cascada del comercio completo, solo desde admin_delete_business.
  if tg_op = 'DELETE'
     and coalesce(v_borrando, '') <> ''
     and current_user not in ('anon', 'authenticated', 'service_role')
     and (to_jsonb(old) ->> 'business_id') = v_borrando then
    return old;
  end if;
  -- Borrado de un cliente completo, solo desde admin_delete_customer (la auditoría nunca se borra).
  if tg_op = 'DELETE'
     and tg_table_name <> 'audit_logs'
     and coalesce(v_cliente, '') <> ''
     and current_user not in ('anon', 'authenticated', 'service_role')
     and ((to_jsonb(old) ->> 'customer_id') = v_cliente
          or exists (select 1 from public.loyalty_cards c
                     where c.id::text = (to_jsonb(old) ->> 'card_id') and c.customer_id::text = v_cliente)) then
    return old;
  end if;
  raise exception 'IMMUTABLE_LEDGER: % no admite %', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

create or replace function public.admin_delete_customer(p_customer_id uuid)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_c       public.customers;
  v_visitas integer;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into v_c from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001'; end if;

  select count(*) into v_visitas from public.visits v join public.loyalty_cards c on c.id = v.card_id where c.customer_id = v_c.id;
  -- Queda constancia en el historial del comercio, sin datos personales.
  perform private.audit(v_c.business_id, 'platform.customer_deleted', 'customer', v_c.id::text,
                        jsonb_build_object('visits', v_visitas, 'anonymized', v_c.anonymized_at is not null));

  perform set_config('lazo.eliminando_cliente', v_c.id::text, true);
  -- Primero lo que depende de la tarjeta, de lo dependido a lo que depende.
  delete from public.redemptions r using public.loyalty_cards c where r.card_id = c.id and c.customer_id = v_c.id;
  delete from public.rewards r using public.loyalty_cards c where r.card_id = c.id and c.customer_id = v_c.id;
  delete from public.visits v using public.loyalty_cards c where v.card_id = c.id and c.customer_id = v_c.id;
  delete from public.customer_contacts where customer_id = v_c.id;
  -- La tarjeta, sus avisos y sus pases se borran en cascada con el cliente.
  delete from public.customers where id = v_c.id;
  perform set_config('lazo.eliminando_cliente', '', true);
end;
$$;
revoke all on function public.admin_delete_customer(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_customer(uuid) to authenticated;

-- >>> 20261101000046_sello_sin_qr.sql
-- =====================================================================
-- Sello sin QR (pedidos a domicilio o código que no se puede leer)
--  * El motivo de una visita sumada a mano queda también en la visita misma (columna reason),
--    no solo en la auditoría: así se ve en el historial y en la ficha del cliente.
--    El motivo puede incluir el número de factura o de pedido (p. ej. «Pedido a domicilio · Factura FV-1234»).
--  * record_visit recibe el motivo como parámetro opcional (las visitas ya no se pueden editar
--    después de creadas). Todo lo demás es igual que en la migración 0044.
--  * Compatible hacia atrás: register_manual_visit conserva sus parámetros.
-- =====================================================================

-- Se reemplaza por la versión con el motivo (mismo nombre, un parámetro opcional más).
drop function if exists private.record_visit(uuid, text, uuid, uuid, text, integer);

create or replace function private.record_visit(
  p_card_id uuid,
  p_idempotency_key text,
  p_location_id uuid,
  p_staff uuid,
  p_source text,
  p_min_minutes integer,
  p_reason text default null
)
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
  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;

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

  -- Los sellos de prueba de la demo usan su propio freno (demo_add_stamp), no el del programa.
  if p_source <> 'demo'
     and v_card.last_visit_at is not null
     and greatest(v_program.min_minutes_between_visits, coalesce(p_min_minutes, 0)) > 0
     and v_card.last_visit_at > now() - make_interval(mins => greatest(v_program.min_minutes_between_visits, coalesce(p_min_minutes, 0))) then
    raise exception 'TOO_SOON';
  end if;

  -- Promoción vigente hoy (p. ej. doble sello): suma sellos extra en la misma visita.
  select * into v_promo from private.active_promotion(v_card.business_id);
  v_bonus := coalesce(v_promo.bonus_stamps, 0);

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key, bonus_stamps, promotion_id, location_id, source, reason)
  values (v_card.business_id, v_card.id, 'visit', 1, p_staff, p_idempotency_key, v_bonus, v_promo.id, p_location_id, p_source,
          nullif(left(btrim(coalesce(p_reason, '')), 200), ''))
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
                        jsonb_build_object('card_id', v_card.id, 'bonus_stamps', v_bonus, 'promotion_id', v_promo.id, 'source', p_source));
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

create or replace function public.register_manual_visit(
  p_card_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_result   jsonb;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select business_id into v_business from public.loyalty_cards where id = p_card_id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_business) then raise exception 'FORBIDDEN'; end if;
  if length(v_reason) < 5 then raise exception 'REASON_REQUIRED'; end if;

  v_result := private.record_visit(p_card_id, p_idempotency_key, p_location_id, auth.uid(), 'manual', 0, v_reason);

  perform private.audit(v_business, 'visit.manual', 'loyalty_card', p_card_id::text,
    jsonb_build_object('reason', left(v_reason, 200), 'visit_id', v_result ->> 'visit_id'));
  return v_result;
end;
$$;

revoke all on function public.register_manual_visit(uuid, text, text, uuid) from public, anon;
grant execute on function public.register_manual_visit(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Funciones internas cerradas. Las funciones de «private» creadas después de la migración 0002
-- quedaban con el permiso por defecto de Postgres (cualquiera puede ejecutarlas). El esquema
-- private no está expuesto en la API, pero se cierran por si acaso: solo las llaman otras
-- funciones del sistema (security definer) o disparadores, nunca un usuario directamente.
-- Las que usan las reglas de acceso (RLS) y las validaciones siguen abiertas, como deben.
-- ---------------------------------------------------------------------
revoke all on function private.record_visit(uuid, text, uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function private.nfc_comprobar_ubicacion(private.business_nfc, double precision, double precision) from public, anon, authenticated;
revoke all on function private.tiene_sede_con_ubicacion(uuid) from public, anon, authenticated;
revoke all on function private.metros_entre(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function private.create_business_billing() from public, anon, authenticated;
revoke all on function private.customer_first_name() from public, anon, authenticated;

commit;
