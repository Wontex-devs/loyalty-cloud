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
