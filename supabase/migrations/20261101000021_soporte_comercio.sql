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
