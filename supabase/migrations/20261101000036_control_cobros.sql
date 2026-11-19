-- =====================================================================
-- Control de cobros a los comercios (sin pago en línea todavía).
--  * Cada comercio tiene una fecha «pagado hasta». Al crearlo, es un mes después (el mes gratis).
--  * El superadministrador registra cada pago (transferencia, efectivo…): se guarda en el historial
--    y la fecha avanza los meses pagados.
--  * También puede corregir la fecha a mano, con motivo. Todo queda en la auditoría.
--  * Solo el equipo de la plataforma (superadministrador o soporte) ve esta información. El comercio no.
--  * Nada se suspende solo: el panel muestra los vencidos y la persona decide.
-- =====================================================================

create table public.business_billing (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  paid_until  date not null,
  updated_at  timestamptz not null default now()
);
create trigger business_billing_updated_at before update on public.business_billing
  for each row execute function private.touch_updated_at();

create table public.business_payments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount      integer not null check (amount between 0 and 100000000),
  paid_on     date not null,
  months      integer not null check (months between 1 and 12),
  paid_until  date not null,
  note        text check (note is null or length(note) <= 200),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index business_payments_business_idx on public.business_payments (business_id, created_at desc);

alter table public.business_billing enable row level security;
alter table public.business_payments enable row level security;
create policy business_billing_read on public.business_billing for select to authenticated using (private.is_platform_reader());
create policy business_payments_read on public.business_payments for select to authenticated using (private.is_platform_reader());
revoke all on public.business_billing, public.business_payments from anon, authenticated;
grant select on public.business_billing, public.business_payments to authenticated;

-- Comercios existentes: un mes después de su alta. Se corrige a mano en el panel si no coincide.
insert into public.business_billing (business_id, paid_until)
select id, (created_at at time zone 'America/Bogota')::date + interval '1 month'
from public.businesses
on conflict (business_id) do nothing;

-- Comercio nuevo: el primer mes es gratis.
create function private.create_business_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_billing (business_id, paid_until)
  values (new.id, (now() at time zone 'America/Bogota')::date + interval '1 month')
  on conflict (business_id) do nothing;
  return new;
end;
$$;
create trigger businesses_billing after insert on public.businesses
  for each row execute function private.create_business_billing();

-- ---------- Registrar un pago ----------
-- La fecha avanza desde «pagado hasta» (no desde hoy): así el ciclo de cobro no se corre si pagan tarde.
create function public.register_business_payment(
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
declare
  v_antes date;
  v_hasta date;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_amount is null or p_amount < 0 or p_months is null or p_months not between 1 and 12 or p_paid_on is null then
    raise exception 'INVALID_INPUT';
  end if;
  select paid_until into v_antes from public.business_billing where business_id = p_business_id for update;
  if not found then
    if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
    v_antes := (now() at time zone 'America/Bogota')::date;
    insert into public.business_billing (business_id, paid_until) values (p_business_id, v_antes);
  end if;
  v_hasta := (v_antes + make_interval(months => p_months))::date;
  update public.business_billing set paid_until = v_hasta where business_id = p_business_id;
  insert into public.business_payments (business_id, amount, paid_on, months, paid_until, note, created_by)
  values (p_business_id, p_amount, p_paid_on, p_months, v_hasta, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  perform private.audit(p_business_id, 'billing.payment_registered', 'business', p_business_id::text,
                        jsonb_build_object('amount', p_amount, 'months', p_months, 'paid_on', p_paid_on, 'from', v_antes, 'to', v_hasta));
  return v_hasta;
end;
$$;

-- ---------- Corregir la fecha a mano ----------
create function public.set_business_paid_until(p_business_id uuid, p_paid_until date, p_reason text)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_antes date;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
  if p_paid_until is null or length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'INVALID_INPUT'; end if;
  if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'BUSINESS_NOT_FOUND'; end if;
  select paid_until into v_antes from public.business_billing where business_id = p_business_id;
  insert into public.business_billing (business_id, paid_until) values (p_business_id, p_paid_until)
  on conflict (business_id) do update set paid_until = excluded.paid_until;
  perform private.audit(p_business_id, 'billing.paid_until_changed', 'business', p_business_id::text,
                        jsonb_build_object('from', v_antes, 'to', p_paid_until, 'reason', left(trim(p_reason), 200)));
end;
$$;

revoke all on function public.register_business_payment(uuid, integer, date, integer, text) from public, anon, authenticated;
grant execute on function public.register_business_payment(uuid, integer, date, integer, text) to authenticated;
revoke all on function public.set_business_paid_until(uuid, date, text) from public, anon, authenticated;
grant execute on function public.set_business_paid_until(uuid, date, text) to authenticated;
