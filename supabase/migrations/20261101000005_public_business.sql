-- =====================================================================
-- Etapa 3 · Vista pública mínima del comercio para la página de inscripción
-- (QR general). Solo identidad visual y reglas del programa: nada de clientes.
-- =====================================================================
create function public.get_public_business(p_slug text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'category', b.category,
    'branding', b.branding,
    'program', jsonb_build_object(
      'name', p.name,
      'description', p.description,
      'stamps_required', p.stamps_required,
      'reward_name', p.reward_name,
      'reward_description', p.reward_description,
      'terms', p.terms
    )
  )
  from public.businesses b
  join lateral (
    select * from public.loyalty_programs lp
    where lp.business_id = b.id and lp.active
    order by lp.created_at limit 1
  ) p on true
  where b.slug = p_slug and b.status <> 'suspended';
$$;

revoke all on function public.get_public_business(text) from public, anon, authenticated;
grant execute on function public.get_public_business(text) to anon, authenticated;
