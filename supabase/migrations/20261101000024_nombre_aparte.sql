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
