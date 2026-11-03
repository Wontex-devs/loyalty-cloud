-- =====================================================================
-- Etapa 10 · Personalización de la tarjeta
-- - Logotipo propio en Supabase Storage (bucket público brand-assets).
--   Cada comercio solo puede escribir en su carpeta: brand-assets/<business_id>/...
-- - Nuevas opciones de marca: icono del sello y tipografía de la tarjeta.
-- =====================================================================

-- ---------- Bucket del logotipo ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 1048576, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- La primera carpeta del archivo es el id del comercio; solo su dueño o admin la edita.
create function private.can_edit_brand_path(p_name text)
returns boolean
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.has_role(v_folder::uuid, '{owner,admin}') or private.is_superadmin();
end;
$$;
revoke all on function private.can_edit_brand_path(text) from public;
grant execute on function private.can_edit_brand_path(text) to authenticated;

create policy brand_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));
create policy brand_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));
create policy brand_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and private.can_edit_brand_path(name))
  with check (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));
create policy brand_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and private.can_edit_brand_path(name));

-- ---------- Validación de la marca ----------
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
      elsif k = 'logoUrl' then
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
