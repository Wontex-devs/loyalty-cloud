-- =====================================================================
-- Etapa 4 · Estadísticas del comercio calculadas en Postgres
-- El panel ya no depende de cuántas filas pueda descargar el navegador:
-- todos los agregados salen de aquí, en la zona horaria del comercio.
-- Solo propietario y administrador (permiso analytics.read).
-- =====================================================================
create function public.business_stats(p_business_id uuid, p_days integer)
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
      select vi.card_id, vi.staff_id, vi.created_at, vi.created_at at time zone v_tz as local_at
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
      'stamp_distribution', (
        select jsonb_agg((select count(*) from public.loyalty_cards c
                          where c.business_id = p_business_id and c.status <> 'blocked'
                            and least(c.current_stamps, v_required - 1) = s) order by s)
        from generate_series(0, v_required - 1) s)
    )
  );
end;
$$;

-- ---------- Canje: tarjeta bloqueada y vencimiento ----------
-- Una tarjeta bloqueada tampoco admite canjes (antes solo se frenaban las visitas).
-- La versión anterior marcaba 'expired' justo antes de lanzar el error, pero el
-- error deshace la transacción y ese cambio nunca se guardaba. Una recompensa
-- con expires_at pasado se trata como vencida en todas las lecturas.
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_reward     public.rewards;
  v_redemption uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if not private.can_redeem(v_reward.business_id) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.businesses where id = v_reward.business_id and status = 'suspended') then
    raise exception 'BUSINESS_SUSPENDED';
  end if;
  if v_reward.status = 'redeemed' then raise exception 'ALREADY_REDEEMED'; end if;
  if v_reward.status <> 'available' then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then raise exception 'REWARD_EXPIRED'; end if;
  if exists (select 1 from public.loyalty_cards where id = v_reward.card_id and status = 'blocked') then
    raise exception 'CARD_BLOCKED';
  end if;

  insert into public.redemptions (business_id, reward_id, card_id, staff_id)
  values (v_reward.business_id, v_reward.id, v_reward.card_id, auth.uid())
  returning id into v_redemption;

  update public.rewards set status = 'redeemed', status_changed_at = now() where id = v_reward.id;

  update public.loyalty_cards c
  set status = 'active'
  where c.id = v_reward.card_id and c.status = 'reward_available'
    and not exists (select 1 from public.rewards r where r.card_id = c.id and r.status = 'available'
                    and (r.expires_at is null or r.expires_at > now()));

  perform private.audit(v_reward.business_id, 'reward.redeemed', 'reward', v_reward.id::text,
                        jsonb_build_object('redemption_id', v_redemption, 'card_id', v_reward.card_id));
  return jsonb_build_object('redemption_id', v_redemption);
end;
$$;

revoke all on function public.business_stats(uuid, integer) from public, anon, authenticated;
grant execute on function public.business_stats(uuid, integer) to authenticated;

-- ---------- Exportación de clientes: queda en la auditoría ----------
-- La lectura la hace la app con RLS; esto solo deja constancia de quién exportó datos personales.
create function public.log_customers_export(p_business_id uuid, p_count integer)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_business_id, '{owner}') then raise exception 'FORBIDDEN'; end if;
  perform private.audit(p_business_id, 'customers.exported', 'business', p_business_id::text,
                        jsonb_build_object('rows', greatest(coalesce(p_count, 0), 0)));
end;
$$;

revoke all on function public.log_customers_export(uuid, integer) from public, anon, authenticated;
grant execute on function public.log_customers_export(uuid, integer) to authenticated;
