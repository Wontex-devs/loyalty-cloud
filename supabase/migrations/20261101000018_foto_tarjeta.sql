-- =====================================================================
-- Foto de fondo de la tarjeta y colores iniciales nuevos.
-- - coverUrl sigue la misma regla que logoUrl: vacío para quitarla o una imagen
--   de la carpeta del propio comercio en Storage.
-- - Los comercios nuevos arrancan con los colores de Lazo; los existentes no cambian.
-- =====================================================================

create or replace function public.update_business_profile(
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
  v text;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_branding is not null then
    for k in select jsonb_object_keys(p_branding) loop
      v := p_branding ->> k;
      if k = 'logoText' then
        if v is null or length(trim(v)) not between 1 and 3 then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('logoUrl', 'coverUrl') then
        -- Vacío = quitar el logo. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans') then raise exception 'INVALID_BRANDING'; end if;
      elsif k in ('primary', 'primaryForeground', 'accent', 'cardBackground', 'cardForeground') then
        if v is null or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_BRANDING'; end if;
      else
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

create or replace function public.create_business(
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
          jsonb_build_object('logoText', upper(left(trim(p_name), 2)), 'primary', '#1b3fd8',
                             'primaryForeground', '#ffc928', 'accent', '#ffc928',
                             'cardBackground', '#1b3fd8', 'cardForeground', '#ffc928'))
  returning id into v_id;

  insert into public.loyalty_programs (business_id, name, stamps_required, reward_name)
  values (v_id, trim(p_name), p_stamps_required, p_reward_name);

  perform private.audit(null, 'business.created', 'business', v_id::text, jsonb_build_object('slug', p_slug));
  return v_id;
end;
$$;
