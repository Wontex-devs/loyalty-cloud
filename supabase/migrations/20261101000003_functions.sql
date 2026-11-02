-- =====================================================================
-- Etapa 2 · Funciones RPC transaccionales
-- Todas son SECURITY DEFINER con search_path vacío y comprueban permisos
-- explícitamente. Los errores de negocio se lanzan con el código como
-- mensaje (p. ej. 'TOO_SOON') para que la app los traduzca.
-- =====================================================================

-- ---------- Público: inscripción (QR general del comercio) ----------
create function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean
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
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id)
  values (v_business.id, v_program.id, v_customer.id)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false)));
  return query select v_card.public_token, false;
end;
$$;

-- ---------- Público: vista mínima de la tarjeta por token ----------
-- Nunca devuelve teléfono, correo ni IDs internos de otras entidades.
create function public.get_public_card(p_token text)
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
      select jsonb_agg(jsonb_build_object('name', r.name, 'earned_at', r.earned_at, 'expires_at', r.expires_at)
                       order by r.earned_at)
      from public.rewards r
      where r.card_id = c.id and r.status = 'available'
        and (r.expires_at is null or r.expires_at > now())
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('kind', v.kind, 'delta', v.delta, 'created_at', v.created_at)
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

-- ---------- Registrar visita ----------
create function public.register_visit(p_card_id uuid, p_idempotency_key text)
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
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;

  -- Bloqueo de fila: serializa visitas concurrentes sobre la misma tarjeta.
  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_card.business_id) then raise exception 'FORBIDDEN'; end if;

  select status into v_status from public.businesses where id = v_card.business_id;
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

  insert into public.visits (business_id, card_id, kind, delta, staff_id, idempotency_key)
  values (v_card.business_id, v_card.id, 'visit', 1, auth.uid(), p_idempotency_key)
  returning id into v_visit_id;

  v_stamps := v_card.current_stamps + 1;
  if v_stamps >= v_program.stamps_required then
    v_stamps := 0;
    insert into public.rewards (business_id, card_id, program_id, source_visit_id, name, expires_at)
    values (v_card.business_id, v_card.id, v_program.id, v_visit_id, v_program.reward_name,
            case when v_program.reward_expiry_days is not null
                 then now() + make_interval(days => v_program.reward_expiry_days) end)
    returning id into v_reward_id;
  end if;

  update public.loyalty_cards
  set current_stamps = v_stamps,
      total_visits   = total_visits + 1,
      last_visit_at  = now(),
      status         = case when v_reward_id is not null then 'reward_available' else status end
  where id = v_card.id;

  perform private.audit(v_card.business_id, 'visit.created', 'visit', v_visit_id::text,
                        jsonb_build_object('card_id', v_card.id));
  if v_reward_id is not null then
    perform private.audit(v_card.business_id, 'reward.earned', 'reward', v_reward_id::text,
                          jsonb_build_object('card_id', v_card.id));
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'reward_id', v_reward_id, 'current_stamps', v_stamps);
end;
$$;

-- ---------- Revertir visita (corrección auditada, sin borrar) ----------
create function public.reverse_visit(p_visit_id uuid, p_reason text)
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
    v_stamps := v_program.stamps_required - 1;
  else
    v_stamps := greatest(v_card.current_stamps - 1, 0);
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

-- ---------- Canjear recompensa ----------
create function public.redeem_reward(p_reward_id uuid)
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
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then
    update public.rewards set status = 'expired', status_changed_at = now() where id = v_reward.id;
    raise exception 'REWARD_EXPIRED';
  end if;

  insert into public.redemptions (business_id, reward_id, card_id, staff_id)
  values (v_reward.business_id, v_reward.id, v_reward.card_id, auth.uid())
  returning id into v_redemption;

  update public.rewards set status = 'redeemed', status_changed_at = now() where id = v_reward.id;

  update public.loyalty_cards c
  set status = 'active'
  where c.id = v_reward.card_id and c.status = 'reward_available'
    and not exists (select 1 from public.rewards r where r.card_id = c.id and r.status = 'available');

  perform private.audit(v_reward.business_id, 'reward.redeemed', 'reward', v_reward.id::text,
                        jsonb_build_object('redemption_id', v_redemption, 'card_id', v_reward.card_id));
  return jsonb_build_object('redemption_id', v_redemption);
end;
$$;

-- ---------- Bloquear / activar tarjeta ----------
create function public.set_card_blocked(p_card_id uuid, p_blocked boolean)
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

-- ---------- Comercio: perfil e identidad visual (owner/admin) ----------
create function public.update_business_profile(
  p_business_id uuid,
  p_name text,
  p_category text,
  p_city text,
  p_timezone text,
  p_branding jsonb
)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      if k not in ('logoText', 'logoUrl', 'primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        raise exception 'INVALID_BRANDING';
      end if;
      if k not in ('logoText', 'logoUrl') and (p_branding ->> k) !~ '^#[0-9a-fA-F]{6}$' then
        raise exception 'INVALID_BRANDING';
      end if;
    end loop;
  end if;

  update public.businesses
  set name     = coalesce(nullif(trim(p_name), ''), name),
      category = coalesce(nullif(trim(p_category), ''), category),
      city     = coalesce(nullif(trim(p_city), ''), city),
      timezone = coalesce(nullif(trim(p_timezone), ''), timezone),
      branding = case when p_branding is null then branding else branding || p_branding end
  where id = p_business_id;

  perform private.audit(p_business_id, 'business.updated', 'business', p_business_id::text,
                        jsonb_build_object('branding_changed', p_branding is not null));
end;
$$;

-- ---------- Plataforma (superadmin) ----------
create function public.create_business(
  p_name text,
  p_slug text,
  p_category text,
  p_city text,
  p_plan_id text,
  p_reward_name text default 'Recompensa',
  p_stamps_required integer default 9
)
returns uuid
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.businesses where slug = p_slug) then raise exception 'SLUG_TAKEN'; end if;

  insert into public.businesses (name, slug, category, city, plan_id, status, branding)
  values (trim(p_name), p_slug, p_category, p_city, p_plan_id, 'trial',
          jsonb_build_object('logoText', upper(left(trim(p_name), 2)), 'primary', '#111111',
                             'primaryForeground', '#FFFFFF', 'accent', '#D8A7A7',
                             'cardBackground', '#EBCFCB', 'cardForeground', '#1A1416'))
  returning id into v_id;

  insert into public.loyalty_programs (business_id, name, stamps_required, reward_name)
  values (v_id, trim(p_name), p_stamps_required, p_reward_name);

  perform private.audit(null, 'business.created', 'business', v_id::text, jsonb_build_object('slug', p_slug));
  return v_id;
end;
$$;

create function public.set_business_status(p_business_id uuid, p_status public.business_status, p_reason text default null)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  update public.businesses set status = p_status where id = p_business_id;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  perform private.audit(null, 'business.' || p_status::text, 'business', p_business_id::text,
                        jsonb_build_object('reason', p_reason));
end;
$$;

-- Agregados por comercio para el superadmin (sin datos personales).
create function public.platform_business_stats()
returns table (business_id uuid, customers bigint, visits_30d bigint, redemptions_30d bigint)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  return query
  select b.id,
         (select count(*) from public.customers c where c.business_id = b.id),
         (select count(*) from public.visits v where v.business_id = b.id and v.kind = 'visit'
            and v.created_at > now() - interval '30 days'),
         (select count(*) from public.redemptions r where r.business_id = b.id
            and r.created_at > now() - interval '30 days')
  from public.businesses b;
end;
$$;

-- ---------- Auditoría automática de cambios de configuración ----------
create function private.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.audit(
    coalesce(new.business_id, old.business_id),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('changed', (
        select coalesce(jsonb_agg(key), '[]'::jsonb) from jsonb_each(to_jsonb(new)) n
        where n.value is distinct from (to_jsonb(old) -> n.key) and n.key <> 'updated_at'))
      else '{}'::jsonb end
  );
  return coalesce(new, old);
end;
$$;

create trigger loyalty_programs_audit after insert or update on public.loyalty_programs
  for each row execute function private.audit_config_change();
create trigger business_memberships_audit after insert or update or delete on public.business_memberships
  for each row execute function private.audit_config_change();

-- ---------- Permisos de ejecución ----------
revoke all on function
  public.join_program(text, text, text, text, boolean, boolean),
  public.get_public_card(text),
  public.register_visit(uuid, text),
  public.reverse_visit(uuid, text),
  public.redeem_reward(uuid),
  public.set_card_blocked(uuid, boolean),
  public.update_business_profile(uuid, text, text, text, text, jsonb),
  public.create_business(text, text, text, text, text, text, integer),
  public.set_business_status(uuid, public.business_status, text),
  public.platform_business_stats()
from public, anon, authenticated;

grant execute on function public.join_program(text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.get_public_card(text) to anon, authenticated;
grant execute on function
  public.register_visit(uuid, text),
  public.reverse_visit(uuid, text),
  public.redeem_reward(uuid),
  public.set_card_blocked(uuid, boolean),
  public.update_business_profile(uuid, text, text, text, text, jsonb),
  public.create_business(text, text, text, text, text, text, integer),
  public.set_business_status(uuid, public.business_status, text),
  public.platform_business_stats()
to authenticated;
