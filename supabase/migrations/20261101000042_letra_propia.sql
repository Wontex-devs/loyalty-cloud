-- =====================================================================
-- Letra propia del comercio: sube su tipografía (TTF, OTF o WOFF) y se usa en la tarjeta,
-- el pase de Wallet, la página de registro y el QR de inscripción.
--  * branding admite 'font' = 'propia', 'fontUrl' (archivo de su carpeta en Storage) y
--    'fontName' (cómo se llama, para mostrarlo en el panel).
--  * El almacenamiento de marca acepta archivos de letra y hasta 2 MB (las letras pesan más
--    que un logo).
--  * Solo cambian la validación de update_business_profile y el almacenamiento; no toca datos.
-- =====================================================================

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg', 'font/ttf', 'font/otf', 'font/woff']
where id = 'brand-assets';

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
      elsif k in ('logoUrl', 'coverUrl', 'stampUrl', 'illustrationUrl') then
        -- Vacío = quitar la imagen. Si no, solo una imagen de su propia carpeta en Storage.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'fontUrl' then
        -- Letra propia: vacío = quitarla; si no, un archivo de letra (TTF, OTF o WOFF) de su carpeta.
        if v is null or (v <> '' and v !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                                           || p_business_id::text || '/[A-Za-z0-9._-]+\.(ttf|otf|woff)$')) then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'fontName' then
        -- Nombre de la letra para mostrar en el panel (sin saltos de línea ni comillas).
        if v is null or length(trim(v)) > 40 or v ~ '[\n\r"<>]' then raise exception 'INVALID_BRANDING'; end if;
      elsif k = 'stampIcon' then
        if v is null or v not in ('check', 'heart', 'star', 'sparkles', 'flower', 'gem', 'crown', 'scissors', 'coffee') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'font' then
        if v is null or v not in ('serif', 'sans', 'elegante', 'manuscrita', 'redondeada', 'impacto', 'geometrica', 'propia') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'cardStyle' then
        if v is null or v not in ('clasico', 'noche', 'cristal', 'negro', 'marfil') then
          raise exception 'INVALID_BRANDING';
        end if;
      elsif k = 'passQr' then
        -- Código QR en la tarjeta y en el pase: solo verdadero o falso.
        if jsonb_typeof(p_branding -> k) is distinct from 'boolean' then raise exception 'INVALID_BRANDING'; end if;
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
