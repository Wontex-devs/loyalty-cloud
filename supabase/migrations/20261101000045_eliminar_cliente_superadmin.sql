-- =====================================================================
-- Cupo de clientes y borrado de clientes.
--  * El comercio (propietario) puede eliminar los DATOS de un cliente (anonymize_customer): se borran
--    nombre, celular, correo y cumpleaños, y la tarjeta deja de funcionar. El registro queda y SIGUE
--    OCUPANDO CUPO del plan: así nadie borra clientes para hacerle espacio a otros.
--  * Solo el superadministrador puede eliminar un cliente por completo (admin_delete_customer):
--    se borran su tarjeta, visitas, premios, canjes y contactos, y se libera el cupo.
--  * El historial (visitas, canjes, contactos) sigue sin poderse borrar por ninguna otra vía.
-- =====================================================================

-- El bloqueo del historial admite, además del borrado de un comercio completo, el borrado de un
-- cliente completo hecho desde admin_delete_customer.
create or replace function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
  v_borrando text := current_setting('lazo.eliminando_comercio', true);
  v_cliente  text := current_setting('lazo.eliminando_cliente', true);
begin
  if tg_op = 'UPDATE' and actor_col is not null
     and (to_jsonb(new) ->> actor_col) is null
     and (to_jsonb(new) - actor_col) = (to_jsonb(old) - actor_col) then
    return new;
  end if;
  -- Borrado en cascada del comercio completo, solo desde admin_delete_business.
  if tg_op = 'DELETE'
     and coalesce(v_borrando, '') <> ''
     and current_user not in ('anon', 'authenticated', 'service_role')
     and (to_jsonb(old) ->> 'business_id') = v_borrando then
    return old;
  end if;
  -- Borrado de un cliente completo, solo desde admin_delete_customer (la auditoría nunca se borra).
  if tg_op = 'DELETE'
     and tg_table_name <> 'audit_logs'
     and coalesce(v_cliente, '') <> ''
     and current_user not in ('anon', 'authenticated', 'service_role')
     and ((to_jsonb(old) ->> 'customer_id') = v_cliente
          or exists (select 1 from public.loyalty_cards c
                     where c.id::text = (to_jsonb(old) ->> 'card_id') and c.customer_id::text = v_cliente)) then
    return old;
  end if;
  raise exception 'IMMUTABLE_LEDGER: % no admite %', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

create or replace function public.admin_delete_customer(p_customer_id uuid)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_c       public.customers;
  v_visitas integer;
begin
  if not private.is_superadmin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into v_c from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001'; end if;

  select count(*) into v_visitas from public.visits v join public.loyalty_cards c on c.id = v.card_id where c.customer_id = v_c.id;
  -- Queda constancia en el historial del comercio, sin datos personales.
  perform private.audit(v_c.business_id, 'platform.customer_deleted', 'customer', v_c.id::text,
                        jsonb_build_object('visits', v_visitas, 'anonymized', v_c.anonymized_at is not null));

  perform set_config('lazo.eliminando_cliente', v_c.id::text, true);
  -- Primero lo que depende de la tarjeta, de lo dependido a lo que depende.
  delete from public.redemptions r using public.loyalty_cards c where r.card_id = c.id and c.customer_id = v_c.id;
  delete from public.rewards r using public.loyalty_cards c where r.card_id = c.id and c.customer_id = v_c.id;
  delete from public.visits v using public.loyalty_cards c where v.card_id = c.id and c.customer_id = v_c.id;
  delete from public.customer_contacts where customer_id = v_c.id;
  -- La tarjeta, sus avisos y sus pases se borran en cascada con el cliente.
  delete from public.customers where id = v_c.id;
  perform set_config('lazo.eliminando_cliente', '', true);
end;
$$;
revoke all on function public.admin_delete_customer(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_customer(uuid) to authenticated;
