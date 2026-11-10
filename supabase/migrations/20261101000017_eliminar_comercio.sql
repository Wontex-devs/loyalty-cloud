-- =====================================================================
-- Eliminar un comercio completo (solo superadministradores).
-- - El historial (visitas, canjes, contactos, auditoría) sigue siendo inmodificable.
--   Única excepción nueva: se borra entero cuando se elimina SU comercio, y solo
--   dentro de public.admin_delete_business (marca de sesión + rol del dueño de la función).
-- - Hay que escribir el identificador (slug) del comercio para confirmar.
-- - La eliminación queda en la auditoría de la plataforma (sin comercio).
-- =====================================================================

create or replace function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
  v_borrando text := current_setting('lazo.eliminando_comercio', true);
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
  raise exception 'IMMUTABLE_LEDGER: % no admite %', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

-- Al borrar el comercio no se audita cada miembro que se va con él
-- (la fila apuntaría a un comercio que ya no existe).
create or replace function private.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('lazo.eliminando_comercio', true), '') = old.business_id::text then
    return old;
  end if;
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
revoke all on function private.audit_config_change() from public, anon, authenticated;

create function public.admin_delete_business(p_business_id uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.businesses;
begin
  if not private.is_superadmin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_b from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_confirm_slug is distinct from v_b.slug then
    raise exception 'CONFIRMATION_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata)
  values (null, auth.uid(), 'platform.business_deleted', 'business', v_b.id::text,
          jsonb_build_object('slug', v_b.slug, 'name', v_b.name, 'plan', v_b.plan_id));

  perform set_config('lazo.eliminando_comercio', v_b.id::text, true);
  delete from public.businesses where id = v_b.id;
  perform set_config('lazo.eliminando_comercio', '', true);
end;
$$;
revoke all on function public.admin_delete_business(uuid, text) from public, anon;
grant execute on function public.admin_delete_business(uuid, text) to authenticated;
