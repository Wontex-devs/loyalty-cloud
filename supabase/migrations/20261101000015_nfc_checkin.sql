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
