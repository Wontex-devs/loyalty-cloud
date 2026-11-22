-- =====================================================================
-- Control de cobros con la nueva oferta del plan Starter:
-- «pagas el primer mes y el segundo es gratis».
--  * Un comercio nuevo empieza sin meses pagados: «pagado hasta» es el día en que se crea
--    (aparece por cobrar hasta que pague el primer mes).
--  * Cada comercio nuevo queda con el mes gratis pendiente (business_billing.free_month_pending).
--    El primer pago que se le registre estando en el plan Starter suma, además de los meses pagados,
--    ese mes gratis, y lo marca como usado. Queda en el historial (free_months) y en la auditoría.
--  * Ese primer pago cuenta desde la fecha en que pagó si es posterior a «pagado hasta»:
--    así no pierde días por haber pagado unos días después de crearse.
--  * Los comercios que ya existían no cambian: ya tuvieron su mes gratis con la oferta anterior.
-- =====================================================================

alter table public.business_payments
  add column if not exists free_months integer not null default 0 check (free_months between 0 and 12);
-- Los existentes quedan en false: su mes gratis ya se dio al crearlos.
alter table public.business_billing
  add column if not exists free_month_pending boolean not null default false;

-- Comercio nuevo: sin meses pagados todavía.
create or replace function private.create_business_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_billing (business_id, paid_until, free_month_pending)
  values (new.id, (now() at time zone 'America/Bogota')::date, true)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

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
declare
  v_antes date;
  v_desde date;
  v_hasta date;
  v_gratis integer := 0;
  v_pendiente boolean := false;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN'; end if;
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

  -- El primer pago cierra la oferta: aunque no fuera Starter, ya no queda pendiente.
  update public.business_billing set paid_until = v_hasta, free_month_pending = false where business_id = p_business_id;
  insert into public.business_payments (business_id, amount, paid_on, months, free_months, paid_until, note, created_by)
  values (p_business_id, p_amount, p_paid_on, p_months, v_gratis, v_hasta, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  perform private.audit(p_business_id, 'billing.payment_registered', 'business', p_business_id::text,
                        jsonb_build_object('amount', p_amount, 'months', p_months, 'free_months', v_gratis,
                                           'paid_on', p_paid_on, 'from', v_antes, 'to', v_hasta));
  return v_hasta;
end;
$$;

revoke all on function public.register_business_payment(uuid, integer, date, integer, text) from public, anon, authenticated;
grant execute on function public.register_business_payment(uuid, integer, date, integer, text) to authenticated;
