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
