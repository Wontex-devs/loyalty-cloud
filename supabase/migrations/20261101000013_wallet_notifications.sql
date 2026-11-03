-- =====================================================================
-- Etapa 12 · Avisos en la billetera (Google Wallet; Apple Wallet usará lo mismo)
-- - Cada comercio elige qué avisos automáticos envía.
-- - Cada aviso queda registrado una sola vez (card_id, ref): no se repite
--   aunque se reintente la visita o el proceso diario.
-- - Los avisos de visita son transaccionales; cumpleaños, "te extrañamos" y
--   campañas exigen el consentimiento de marketing.
-- =====================================================================

-- ---------- Ajustes por comercio ----------
create function private.valid_wallet_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k
                    where k not in ('stamp', 'near', 'reward', 'birthday', 'winback', 'winbackDays'))
    and jsonb_typeof(s -> 'stamp') = 'boolean'
    and jsonb_typeof(s -> 'near') = 'boolean'
    and jsonb_typeof(s -> 'reward') = 'boolean'
    and jsonb_typeof(s -> 'birthday') = 'boolean'
    and jsonb_typeof(s -> 'winback') = 'boolean'
    and jsonb_typeof(s -> 'winbackDays') = 'number'
    and (s ->> 'winbackDays') ~ '^[0-9]+$'
    and (s ->> 'winbackDays')::int between 14 and 180;
$$;

alter table public.businesses
  add column wallet_notifications jsonb not null
    default '{"stamp": true, "near": true, "reward": true, "birthday": true, "winback": true, "winbackDays": 45}'::jsonb
    check (private.valid_wallet_settings(wallet_notifications));

create function public.update_wallet_settings(p_business_id uuid, p_settings jsonb)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if not private.valid_wallet_settings(p_settings) then raise exception 'INVALID_WALLET_SETTINGS'; end if;
  update public.businesses set wallet_notifications = p_settings where id = p_business_id;
  perform private.audit(p_business_id, 'wallet.settings_updated', 'business', p_business_id::text, p_settings);
end;
$$;

-- ---------- Registro de avisos ----------
create table public.wallet_notifications (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  card_id      uuid not null,
  kind         text not null check (kind in ('stamp', 'near', 'reward', 'birthday', 'winback', 'campaign')),
  -- Clave que impide repetir el mismo aviso: visit:<clave>, birthday:<año>, winback:<última visita>, campaign:<id>.
  ref          text not null check (length(ref) between 3 and 120),
  title        text not null check (length(title) between 1 and 60),
  body         text not null check (length(body) between 1 and 300),
  status       text not null default 'pending' check (status in ('pending', 'sent', 'not_saved', 'failed')),
  staff_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (card_id, ref),
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade
);
create index wallet_notifications_business_idx on public.wallet_notifications (business_id, created_at desc);
create index wallet_notifications_card_idx on public.wallet_notifications (card_id, kind, created_at desc);

alter table public.wallet_notifications enable row level security;
grant select on public.wallet_notifications to authenticated;
grant all on public.wallet_notifications to service_role;
-- Solo lectura para el panel; escribe el servidor (service_role) o las funciones de abajo.
create policy wallet_notifications_read on public.wallet_notifications for select to authenticated
  using (private.has_role(business_id, '{owner,admin}'));

-- ---------- Campañas: un botón para todo un grupo ----------
-- Filtra a quienes aceptaron mensajes, siguen activas y no recibieron otra campaña en 7 días.
create function public.queue_wallet_campaign(p_business_id uuid, p_customer_ids uuid[], p_title text, p_body text)
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
    select c.id as card_id, c.public_token as token, cu.full_name
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
           left(replace(trim(p_body), '{nombre}', split_part(trim(e.full_name), ' ', 1)), 300), auth.uid()
    from eligible e
    on conflict (card_id, ref) do nothing
    returning id, card_id, wallet_notifications.title, wallet_notifications.body
  )
  select ins.id, e.token, ins.title, ins.body from ins join eligible e on e.card_id = ins.card_id;

  perform private.audit(p_business_id, 'wallet.campaign_queued', 'business', p_business_id::text,
                        jsonb_build_object('ref', v_ref, 'title', trim(p_title)));
end;
$$;

-- ---------- Proceso diario: cumpleaños y "te extrañamos" (solo el servidor) ----------
create function public.wallet_daily_candidates(p_now timestamptz default now())
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
           cu.full_name, cu.birth_month, cu.birth_day,
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
         split_part(trim(full_name), ' ', 1), business_name, current_stamps, stamps_required, reward_name
  from base
  where (s ->> 'birthday')::boolean
    and birth_month = extract(month from local_now)::int
    and coalesce(birth_day, 1) = extract(day from local_now)::int
  union all
  select business_id, card_id, public_token, 'winback', 'winback:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         split_part(trim(full_name), ' ', 1), business_name, current_stamps, stamps_required, reward_name
  from base
  where (s ->> 'winback')::boolean
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => (s ->> 'winbackDays')::int)
    -- Solo quienes se enfriaron hace poco: al activar el aviso no se escribe a clientes de hace años.
    and last_visit_at > p_now - make_interval(days => (s ->> 'winbackDays')::int + 30);
$$;

-- ---------- Permisos ----------
revoke all on function private.valid_wallet_settings(jsonb) from public, anon, authenticated;
grant execute on function private.valid_wallet_settings(jsonb) to authenticated, service_role;
revoke all on function public.update_wallet_settings(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_wallet_settings(uuid, jsonb) to authenticated;
revoke all on function public.queue_wallet_campaign(uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.queue_wallet_campaign(uuid, uuid[], text, text) to authenticated;
revoke all on function public.wallet_daily_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_daily_candidates(timestamptz) to service_role;
