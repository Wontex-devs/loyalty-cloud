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
