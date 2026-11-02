-- =====================================================================
-- Etapa 5 · Preparación del piloto
-- - Datos del responsable del tratamiento (Ley 1581 de 2012) en el comercio.
-- - Configuración del comercio editable con validación (incluida la zona horaria).
-- - Freno de inscripciones masivas en la propia base de datos.
-- =====================================================================
alter table public.businesses
  add column legal_name    text check (legal_name is null or length(trim(legal_name)) between 2 and 120),
  add column tax_id        text check (tax_id is null or length(trim(tax_id)) between 3 and 30),
  add column contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column contact_phone text check (contact_phone is null or length(trim(contact_phone)) between 7 and 30),
  add column address       text check (address is null or length(trim(address)) between 5 and 200);

-- ---------- Configuración del comercio (owner/admin) ----------
create function public.update_business_settings(
  p_business_id   uuid,
  p_name          text,
  p_category      text,
  p_city          text,
  p_timezone      text,
  p_legal_name    text,
  p_tax_id        text,
  p_contact_email text,
  p_contact_phone text,
  p_address       text
)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  -- Una zona horaria inválida rompería las estadísticas.
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE';
  end if;

  update public.businesses
  set name          = coalesce(nullif(trim(p_name), ''), name),
      category      = coalesce(nullif(trim(p_category), ''), category),
      city          = coalesce(nullif(trim(p_city), ''), city),
      timezone      = p_timezone,
      legal_name    = nullif(trim(coalesce(p_legal_name, '')), ''),
      tax_id        = nullif(trim(coalesce(p_tax_id, '')), ''),
      contact_email = nullif(lower(trim(coalesce(p_contact_email, ''))), ''),
      contact_phone = nullif(trim(coalesce(p_contact_phone, '')), ''),
      address       = nullif(trim(coalesce(p_address, '')), '')
  where id = p_business_id;

  perform private.audit(p_business_id, 'business.updated', 'business', p_business_id::text,
                        jsonb_build_object('settings', true));
end;
$$;

revoke all on function public.update_business_settings(uuid, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_business_settings(uuid, text, text, text, text, text, text, text, text, text)
  to authenticated;

-- ---------- Ficha pública: añade ciudad y responsable del tratamiento ----------
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'category', b.category,
    'city', b.city,
    -- Responsable del tratamiento de datos: información que debe ser pública.
    'legal', jsonb_build_object(
      'legal_name', b.legal_name,
      'tax_id', b.tax_id,
      'contact_email', b.contact_email,
      'contact_phone', b.contact_phone,
      'address', b.address
    ),
    'branding', b.branding,
    'program', jsonb_build_object(
      'name', p.name,
      'description', p.description,
      'stamps_required', p.stamps_required,
      'reward_name', p.reward_name,
      'reward_description', p.reward_description,
      'reward_expiry_days', p.reward_expiry_days,
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

-- ---------- Inscripción con freno por comercio ----------
create or replace function public.join_program(
  p_slug text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_accept_terms boolean,
  p_marketing_consent boolean
)
returns table (public_token text, existing boolean)
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_program  public.loyalty_programs;
  v_customer public.customers;
  v_card     public.loyalty_cards;
begin
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED';
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found or v_business.status = 'suspended' then
    raise exception 'BUSINESS_UNAVAILABLE';
  end if;

  select * into v_program from public.loyalty_programs
  where business_id = v_business.id and active
  order by created_at limit 1;
  if not found then
    raise exception 'PROGRAM_INACTIVE';
  end if;

  -- ¿Ya existe? Se devuelve su tarjeta sin modificar sus datos.
  select * into v_customer from public.customers
  where business_id = v_business.id and phone_e164 = p_phone_e164;

  if found then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    if found then
      return query select v_card.public_token, true;
      return;
    end if;
  else
    -- Freno en la base de datos (la app añade otro por IP): protege también a quien
    -- llame a la API pública directamente con la clave anónima.
    if (select count(*) from public.customers
        where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 60 then
      raise exception 'RATE_LIMITED';
    end if;

    insert into public.customers (business_id, full_name, phone_e164, email, terms_accepted_at,
                                  marketing_consent, marketing_consent_at)
    values (v_business.id, trim(p_full_name), p_phone_e164, nullif(trim(coalesce(p_email, '')), ''), now(),
            coalesce(p_marketing_consent, false),
            case when p_marketing_consent then now() end)
    on conflict (business_id, phone_e164) do nothing
    returning * into v_customer;

    if v_customer.id is null then  -- carrera con otra inscripción simultánea
      select * into v_customer from public.customers
      where business_id = v_business.id and phone_e164 = p_phone_e164;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id)
  values (v_business.id, v_program.id, v_customer.id)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false)));
  return query select v_card.public_token, false;
end;
$$;
