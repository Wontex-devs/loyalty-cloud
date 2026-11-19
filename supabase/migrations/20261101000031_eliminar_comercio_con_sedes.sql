-- =====================================================================
-- Eliminar comercio: fallaba en comercios reales.
-- Las visitas apuntan a su sede y a su promoción, y las recompensas a su visita,
-- sin borrado en cascada. Al eliminar el comercio, la base borraba primero las sedes
-- o las promociones y encontraba visitas que todavía las usaban: error y no borraba nada.
-- Ahora se borra primero el historial de ese comercio (canjes, recompensas, visitas),
-- en ese orden, y después el comercio con todo lo demás.
-- Sigue siendo solo para superadministradores, con el identificador escrito y con auditoría.
-- =====================================================================
create or replace function public.admin_delete_business(p_business_id uuid, p_confirm_slug text)
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
  -- Primero el historial, de lo que depende a lo dependido.
  delete from public.redemptions where business_id = v_b.id;
  delete from public.rewards where business_id = v_b.id;
  delete from public.visits where business_id = v_b.id;
  delete from public.businesses where id = v_b.id;
  perform set_config('lazo.eliminando_comercio', '', true);
end;
$$;
revoke all on function public.admin_delete_business(uuid, text) from public, anon;
grant execute on function public.admin_delete_business(uuid, text) to authenticated;
