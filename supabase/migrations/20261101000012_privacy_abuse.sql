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
