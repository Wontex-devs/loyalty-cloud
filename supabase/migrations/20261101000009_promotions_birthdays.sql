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
