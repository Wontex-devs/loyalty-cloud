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
