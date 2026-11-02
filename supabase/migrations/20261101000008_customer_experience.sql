-- =====================================================================
-- Etapa 6 · Experiencia de la clienta
-- - Recuperación segura: un celular ya inscrito solo devuelve su tarjeta si el
--   nombre coincide (sin tildes, mayúsculas ni espacios de más).
-- - Sellos de bienvenida: la tarjeta nueva empieza con N sellos de regalo.
-- =====================================================================
create function private.normalize_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(trim(coalesce(p, ''))), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '\s+', ' ', 'g');
$$;
revoke all on function private.normalize_name(text) from public;

alter table public.loyalty_programs
  add column welcome_stamps integer not null default 0 check (welcome_stamps between 0 and 5);
alter table public.loyalty_programs
  add constraint loyalty_programs_welcome_lt_required check (welcome_stamps < stamps_required);

-- ---------- Ficha pública: añade los sellos de bienvenida ----------
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
      'welcome_stamps', p.welcome_stamps,
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

-- ---------- Inscripción: recuperación segura y sellos de bienvenida ----------
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
    -- Recuperar la tarjeta exige el mismo nombre: con solo un número de celular
    -- nadie puede abrir la tarjeta (y ver el nombre) de otra persona.
    if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
      raise exception 'PHONE_REGISTERED';
    end if;
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
      if private.normalize_name(v_customer.full_name) <> private.normalize_name(p_full_name) then
        raise exception 'PHONE_REGISTERED';
      end if;
    end if;
  end if;

  insert into public.loyalty_cards (business_id, program_id, customer_id, current_stamps)
  values (v_business.id, v_program.id, v_customer.id, v_program.welcome_stamps)
  on conflict (program_id, customer_id) do nothing
  returning * into v_card;

  if v_card.id is null then
    select * into v_card from public.loyalty_cards
    where customer_id = v_customer.id and program_id = v_program.id;
    return query select v_card.public_token, true;
    return;
  end if;

  perform private.audit(v_business.id, 'customer.registered', 'customer', v_customer.id::text,
                        jsonb_build_object('marketing_consent', coalesce(p_marketing_consent, false),
                                           'welcome_stamps', v_program.welcome_stamps));
  return query select v_card.public_token, false;
end;
$$;
