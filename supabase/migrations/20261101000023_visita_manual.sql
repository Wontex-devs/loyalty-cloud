-- =====================================================================
-- Etapa 23 · Sumar visita a mano (respaldo cuando el NFC falla en caja)
--  * Cualquier miembro activo del comercio puede sumar la visita desde la ficha del cliente,
--    escribiendo el motivo (5 a 200 caracteres).
--  * Aplica las mismas reglas que cualquier visita (private.record_visit): tiempo mínimo
--    entre visitas, tarjeta bloqueada, comercio suspendido, promociones y premios.
--  * La visita queda con origen 'manual' y además una entrada en la auditoría con el motivo.
--    Se puede revertir como cualquier otra.
-- =====================================================================

alter table public.visits drop constraint if exists visits_source_check;
alter table public.visits add constraint visits_source_check check (source in ('staff', 'nfc', 'manual'));

create or replace function public.register_manual_visit(
  p_card_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_result   jsonb;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select business_id into v_business from public.loyalty_cards where id = p_card_id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if not private.is_member(v_business) then raise exception 'FORBIDDEN'; end if;
  if length(v_reason) < 5 then raise exception 'REASON_REQUIRED'; end if;

  v_result := private.record_visit(p_card_id, p_idempotency_key, p_location_id, auth.uid(), 'manual', 0);

  perform private.audit(v_business, 'visit.manual', 'loyalty_card', p_card_id::text,
    jsonb_build_object('reason', left(v_reason, 200), 'visit_id', v_result ->> 'visit_id'));
  return v_result;
end;
$$;

revoke all on function public.register_manual_visit(uuid, text, text, uuid) from public, anon;
grant execute on function public.register_manual_visit(uuid, text, text, uuid) to authenticated;
