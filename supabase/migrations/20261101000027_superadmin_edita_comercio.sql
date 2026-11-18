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
