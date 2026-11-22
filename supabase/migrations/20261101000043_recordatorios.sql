-- =====================================================================
-- Recordatorios automáticos para que los clientes vuelvan.
--  * «Te falta poco»: a quien está a 1 o 2 sellos del premio (con al menos la mitad de la tarjeta
--    hecha) y lleva unos días sin venir
--    (almost = activo, almostDays = días sin venir, de 5 a 60; por defecto 10).
--  * «Te extrañamos» con mensaje propio del comercio (winbackText, opcional):
--    {nombre}, {comercio} y {progreso} se cambian al enviarlo.
--  * Nunca más de un recordatorio (campaña, te extrañamos o te falta poco) por cliente a la
--    semana: así no se cansa nadie.
--  * Igual que antes: solo a quien aceptó mensajes, con la tarjeta activa, y cada aviso se
--    registra una sola vez por ausencia (no se repite aunque el proceso corra otra vez).
-- =====================================================================

-- ---------- Ajustes: claves nuevas (opcionales: sin ellas se usan los valores por defecto) ----------
create or replace function private.valid_wallet_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k
                    where k not in ('stamp', 'near', 'reward', 'birthday', 'winback', 'winbackDays', 'nearbyText',
                                    'winbackText', 'almost', 'almostDays'))
    and jsonb_typeof(s -> 'stamp') = 'boolean'
    and jsonb_typeof(s -> 'near') = 'boolean'
    and jsonb_typeof(s -> 'reward') = 'boolean'
    and jsonb_typeof(s -> 'birthday') = 'boolean'
    and jsonb_typeof(s -> 'winback') = 'boolean'
    and jsonb_typeof(s -> 'winbackDays') = 'number'
    and (s ->> 'winbackDays') ~ '^[0-9]+$'
    and (s ->> 'winbackDays')::int between 14 and 180
    and (not (s ? 'nearbyText')
         or (jsonb_typeof(s -> 'nearbyText') = 'string'
             and length(btrim(s ->> 'nearbyText')) between 5 and 120))
    and (not (s ? 'winbackText')
         or (jsonb_typeof(s -> 'winbackText') = 'string'
             and length(btrim(s ->> 'winbackText')) between 5 and 200))
    and (not (s ? 'almost') or jsonb_typeof(s -> 'almost') = 'boolean')
    and (not (s ? 'almostDays')
         or (jsonb_typeof(s -> 'almostDays') = 'number'
             and (s ->> 'almostDays') ~ '^[0-9]+$'
             and (s ->> 'almostDays')::int between 5 and 60));
$$;

-- ---------- Registro de avisos: nuevo tipo «almost» (te falta poco) ----------
alter table public.wallet_notifications drop constraint if exists wallet_notifications_kind_check;
alter table public.wallet_notifications add constraint wallet_notifications_kind_check
  check (kind in ('stamp', 'near', 'reward', 'birthday', 'winback', 'almost', 'campaign'));

-- ---------- Candidatos del proceso diario ----------
-- Cambia lo que devuelve (se agrega el mensaje propio), por eso se borra y se crea de nuevo.
drop function if exists public.wallet_daily_candidates(timestamptz);
create function public.wallet_daily_candidates(p_now timestamptz default now())
returns table (business_id uuid, card_id uuid, public_token text, kind text, ref text,
               first_name text, business_name text, current_stamps integer, stamps_required integer, reward_name text,
               message text)
language sql
stable security definer
set search_path = ''
as $$
  with base as (
    select b.id as business_id, b.name as business_name, b.wallet_notifications as s,
           (p_now at time zone b.timezone) as local_now,
           c.id as card_id, c.public_token, c.current_stamps, c.last_visit_at,
           cu.full_name, cu.first_name, cu.birth_month, cu.birth_day,
           p.stamps_required, p.reward_name,
           -- ¿Ya recibió un recordatorio esta semana? (campaña, te extrañamos o te falta poco)
           exists (select 1 from public.wallet_notifications n
                   where n.card_id = c.id and n.kind in ('campaign', 'winback', 'almost')
                     and n.created_at > p_now - interval '7 days') as reciente
    from public.businesses b
    join public.loyalty_cards c on c.business_id = b.id
    join public.customers cu on cu.id = c.customer_id
    join public.loyalty_programs p on p.id = c.program_id
    where b.status <> 'suspended'
      and c.status <> 'blocked'
      and cu.marketing_consent
      and cu.anonymized_at is null
  ),
  dias as (
    select base.*,
           (s ->> 'winbackDays')::int as winback_days,
           coalesce((s ->> 'almostDays')::int, 10) as almost_days,
           coalesce((s ->> 'almost')::boolean, true) as almost_on,
           coalesce(split_part(trim(full_name), ' ', 1), '') as primer_nombre
    from base
  )
  select business_id, card_id, public_token, 'birthday', 'birthday:' || extract(year from local_now)::int,
         coalesce(nullif(btrim(first_name), ''), primer_nombre), business_name, current_stamps, stamps_required, reward_name,
         null::text
  from dias
  where (s ->> 'birthday')::boolean
    and birth_month = extract(month from local_now)::int
    and coalesce(birth_day, 1) = extract(day from local_now)::int
  union all
  select business_id, card_id, public_token, 'winback', 'winback:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         coalesce(nullif(btrim(first_name), ''), primer_nombre), business_name, current_stamps, stamps_required, reward_name,
         nullif(btrim(s ->> 'winbackText'), '')
  from dias
  where (s ->> 'winback')::boolean
    and not reciente
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => winback_days)
    -- Solo quienes se enfriaron hace poco: al activar el aviso no se escribe a clientes de hace años.
    and last_visit_at > p_now - make_interval(days => winback_days + 30)
  union all
  -- Te falta poco: a 1 o 2 sellos del premio y unos días sin venir (antes de «te extrañamos»).
  select business_id, card_id, public_token, 'almost', 'almost:' || to_char(last_visit_at, 'YYYYMMDDHH24MISS'),
         coalesce(nullif(btrim(first_name), ''), primer_nombre), business_name, current_stamps, stamps_required, reward_name,
         null::text
  from dias
  where almost_on
    and not reciente
    and current_stamps > 0
    and stamps_required - current_stamps between 1 and 2
    and current_stamps * 2 >= stamps_required   -- y con al menos la mitad de la tarjeta hecha
    and last_visit_at is not null
    and last_visit_at < p_now - make_interval(days => almost_days)
    and last_visit_at > p_now - make_interval(days => almost_days + 30)
    -- Si ya toca «te extrañamos», ese tiene prioridad.
    and not ((s ->> 'winback')::boolean and last_visit_at < p_now - make_interval(days => winback_days));
$$;
revoke all on function public.wallet_daily_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_daily_candidates(timestamptz) to service_role;
