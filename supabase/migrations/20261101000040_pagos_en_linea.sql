-- =====================================================================
-- Pago del plan en línea con Wompi (PSE, Nequi, tarjeta…).
--  * El dueño o administrador del comercio inicia el pago desde su panel: se crea una
--    «orden» (online_payments) con su referencia única, los meses y el valor según su plan.
--  * Wompi avisa al servidor cuando la transacción termina. El servidor verifica la firma del
--    aviso y llama a confirm_online_payment (solo con la clave del servidor): si quedó
--    APROBADA y el valor coincide, se registra el pago igual que si lo hiciera el
--    superadministrador (misma lógica, incluido el segundo mes gratis del Starter).
--  * Cada orden se aplica una sola vez, aunque Wompi repita el aviso.
--  * El comercio ve su fecha «pagado hasta» y sus órdenes; nunca el resto de cobros.
-- =====================================================================

-- ---------- La lógica de registrar un pago, compartida ----------
-- Antes vivía dentro de register_business_payment (migración 0039). Ahora la usan
-- el superadministrador (pago manual) y la confirmación de Wompi.
create or replace function private.apply_business_payment(
  p_business_id uuid,
  p_amount integer,
  p_paid_on date,
  p_months integer,
  p_note text,
  p_created_by uuid
)
returns date
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_antes date;
  v_desde date;
  v_hasta date;
  v_gratis integer := 0;
  v_pendiente boolean := false;
begin
  if p_amount is null or p_amount < 0 or p_months is null or p_months not between 1 and 12 or p_paid_on is null then
    raise exception 'INVALID_INPUT';
  end if;
  select paid_until, free_month_pending into v_antes, v_pendiente from public.business_billing where business_id = p_business_id for update;
  if not found then
    if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
    v_antes := (now() at time zone 'America/Bogota')::date;
    insert into public.business_billing (business_id, paid_until) values (p_business_id, v_antes);
  end if;

  -- Plan Starter con el mes gratis pendiente: este pago trae el segundo mes gratis.
  if coalesce(v_pendiente, false) and exists (select 1 from public.businesses where id = p_business_id and plan_id = 'plan_starter') then
    v_gratis := 1;
  end if;
  -- La fecha avanza desde «pagado hasta» (no desde hoy) para que el ciclo no se corra si pagan tarde;
  -- solo el primer pago de un comercio nuevo cuenta desde el día en que pagó, si es posterior.
  v_desde := case when coalesce(v_pendiente, false) then greatest(v_antes, p_paid_on) else v_antes end;
  v_hasta := (v_desde + make_interval(months => p_months + v_gratis))::date;

  update public.business_billing set paid_until = v_hasta, free_month_pending = false where business_id = p_business_id;
  insert into public.business_payments (business_id, amount, paid_on, months, free_months, paid_until, note, created_by)
  values (p_business_id, p_amount, p_paid_on, p_months, v_gratis, v_hasta, nullif(trim(coalesce(p_note, '')), ''), p_created_by);
  perform private.audit(p_business_id, 'billing.payment_registered', 'business', p_business_id::text,
                        jsonb_build_object('amount', p_amount, 'months', p_months, 'free_months', v_gratis,
                                           'paid_on', p_paid_on, 'from', v_antes, 'to', v_hasta,
                                           'note', nullif(trim(coalesce(p_note, '')), '')));
  return v_hasta;
end;
$$;
revoke all on function private.apply_business_payment(uuid, integer, date, integer, text, uuid) from public, anon, authenticated;

-- Pago manual del superadministrador: igual que antes, ahora sobre la lógica compartida.
create or replace function public.register_business_payment(
  p_business_id uuid,
  p_amount integer,
  p_paid_on date,
  p_months integer,
  p_note text default null
)
returns date
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  return private.apply_business_payment(p_business_id, p_amount, p_paid_on, p_months, p_note, auth.uid());
end;
$$;
revoke all on function public.register_business_payment(uuid, integer, date, integer, text) from public, anon, authenticated;
grant execute on function public.register_business_payment(uuid, integer, date, integer, text) to authenticated;

-- ---------- Órdenes de pago en línea ----------
create table if not exists public.online_payments (
  reference      text primary key check (reference ~ '^lazo-[a-z0-9-]{8,60}$'),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  months         integer not null check (months between 1 and 12),
  amount_cents   bigint not null check (amount_cents > 0),
  status         text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
  transaction_id text unique,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  applied_at     timestamptz
);
create index if not exists online_payments_business_idx on public.online_payments (business_id, created_at desc);
drop trigger if exists online_payments_updated_at on public.online_payments;
create trigger online_payments_updated_at before update on public.online_payments
  for each row execute function private.touch_updated_at();

alter table public.online_payments enable row level security;
drop policy if exists online_payments_read on public.online_payments;
create policy online_payments_read on public.online_payments for select to authenticated
  using (private.has_role(business_id, '{owner,admin}') or private.is_platform_reader());
revoke all on public.online_payments from anon, authenticated;
grant select on public.online_payments to authenticated;

-- El dueño (o administrador) inicia un pago: el valor lo pone la base de datos según el plan.
create or replace function public.start_online_payment(p_business_id uuid, p_months integer)
returns table (reference text, amount_cents bigint, months integer)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_precio integer;
  v_ref text;
begin
  if not private.has_role(p_business_id, '{owner,admin}') then raise exception 'FORBIDDEN'; end if;
  if p_months is null or p_months not between 1 and 12 then raise exception 'INVALID_INPUT'; end if;
  select p.price_monthly into v_precio
  from public.businesses b join public.plans p on p.id = b.plan_id
  where b.id = p_business_id;
  if v_precio is null or v_precio <= 0 then raise exception 'PLAN_WITHOUT_PRICE'; end if;
  v_ref := 'lazo-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.online_payments (reference, business_id, months, amount_cents, created_by)
  values (v_ref, p_business_id, p_months, v_precio::bigint * p_months * 100, auth.uid());
  perform private.audit(p_business_id, 'billing.online_payment_started', 'business', p_business_id::text,
                        jsonb_build_object('reference', v_ref, 'months', p_months, 'amount_cents', v_precio::bigint * p_months * 100));
  return query select v_ref, v_precio::bigint * p_months * 100, p_months;
end;
$$;
revoke all on function public.start_online_payment(uuid, integer) from public, anon, authenticated;
grant execute on function public.start_online_payment(uuid, integer) to authenticated;

-- Aviso de Wompi (ya verificado por el servidor). Solo con la clave del servidor.
-- Devuelve 'applied' (pago registrado ahora), 'already' (ya se había aplicado), 'updated'
-- (otro estado), 'unknown' (referencia que no existe) o 'mismatch' (el valor no coincide).
create or replace function public.confirm_online_payment(
  p_reference text,
  p_transaction_id text,
  p_status text,
  p_amount_cents bigint
)
returns text
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  o public.online_payments%rowtype;
  v_hasta date;
begin
  select * into o from public.online_payments where reference = p_reference for update;
  if not found then return 'unknown'; end if;
  if o.applied_at is not null then return 'already'; end if;
  if p_status not in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR') then raise exception 'INVALID_INPUT'; end if;

  if p_status = 'APPROVED' then
    if p_amount_cents is distinct from o.amount_cents then
      update public.online_payments set status = 'ERROR', transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
      perform private.audit(o.business_id, 'billing.online_payment_mismatch', 'business', o.business_id::text,
                            jsonb_build_object('reference', p_reference, 'expected', o.amount_cents, 'received', p_amount_cents, 'transaction', p_transaction_id));
      return 'mismatch';
    end if;
    v_hasta := private.apply_business_payment(
      o.business_id, (o.amount_cents / 100)::integer, (now() at time zone 'America/Bogota')::date, o.months,
      'Pago en línea Wompi · ' || coalesce(p_transaction_id, p_reference), o.created_by);
    update public.online_payments set status = 'APPROVED', transaction_id = p_transaction_id, applied_at = now() where reference = p_reference;
    return 'applied';
  end if;

  update public.online_payments set status = p_status, transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
  return 'updated';
end;
$$;
revoke all on function public.confirm_online_payment(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, text, text, bigint) to service_role;

-- Lo que el comercio ve de su cobro: fecha «pagado hasta», si tiene el mes gratis pendiente y el precio.
create or replace function public.my_billing(p_business_id uuid)
returns table (paid_until date, free_month_pending boolean, plan_id text, plan_name text, price_monthly integer)
language sql
stable security definer
set search_path = ''
as $$
  select bb.paid_until, bb.free_month_pending, p.id, p.name, p.price_monthly
  from public.businesses b
  join public.plans p on p.id = b.plan_id
  left join public.business_billing bb on bb.business_id = b.id
  where b.id = p_business_id
    and (private.has_role(p_business_id, '{owner,admin}') or private.is_platform_reader());
$$;
revoke all on function public.my_billing(uuid) from public, anon, authenticated;
grant execute on function public.my_billing(uuid) to authenticated;
