-- =====================================================================
-- Pago en línea con cualquier pasarela (Mercado Pago o Wompi).
--  * Solo cambia la nota con la que queda el pago en el historial de cobros:
--    «Pago en línea · <transacción>» (antes decía «Wompi»). La transacción ya indica la
--    pasarela: las de Mercado Pago empiezan por «mp-».
--  * Nada más cambia: sigue siendo solo para el servidor, una sola vez y con el valor exacto.
-- =====================================================================

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
      'Pago en línea · ' || coalesce(p_transaction_id, p_reference), o.created_by);
    update public.online_payments set status = 'APPROVED', transaction_id = p_transaction_id, applied_at = now() where reference = p_reference;
    return 'applied';
  end if;

  update public.online_payments set status = p_status, transaction_id = coalesce(p_transaction_id, transaction_id) where reference = p_reference;
  return 'updated';
end;
$$;
revoke all on function public.confirm_online_payment(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, text, text, bigint) to service_role;
