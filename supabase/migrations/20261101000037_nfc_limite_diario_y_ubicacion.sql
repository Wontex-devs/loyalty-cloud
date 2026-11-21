-- =====================================================================
-- NFC: límite de sellos por día y, si el comercio quiere, exigir estar en el local.
-- El enlace de la etiqueta es fijo: quien lo guarde puede abrirlo desde su casa. Antes solo lo frenaba
-- el tiempo mínimo entre toques (2 horas por defecto): un sello cada 2 horas sin pisar el local.
--  * max_per_day: sellos por NFC que una tarjeta puede sumar en un día (día del comercio). Por defecto 1.
--  * require_location: el celular debe mandar su ubicación y estar a menos de radius_m metros de una
--    sede con ubicación. La ubicación se usa para comparar y NO se guarda.
--  * En el sello escribiendo el celular, la ubicación se comprueba ANTES de buscar el número: así nadie
--    lejos del local puede usar la respuesta para averiguar si un número es cliente.
--  * Reintentar un toque que ya se registró (misma clave) no choca con estos límites.
-- Las funciones nuevas aceptan los parámetros viejos (los nuevos tienen valor por defecto).
-- =====================================================================

alter table private.business_nfc
  add column if not exists max_per_day      integer not null default 1 check (max_per_day between 1 and 20),
  add column if not exists require_location boolean not null default false,
  add column if not exists radius_m         integer not null default 200 check (radius_m between 50 and 2000);

-- Distancia en metros entre dos puntos (fórmula del semiverseno).
create function private.metros_entre(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))));
$$;

-- ¿Tiene el comercio alguna sede activa con ubicación?
create function private.tiene_sede_con_ubicacion(p_business_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.locations where business_id = p_business_id and active and latitude is not null);
$$;

-- Comprueba la ubicación si el comercio la exige. Si el comercio se quedó sin sedes con ubicación,
-- no bloquea (no se puede comparar contra nada): el panel no deja activarlo en ese caso.
create function private.nfc_comprobar_ubicacion(p_nfc private.business_nfc, p_lat double precision, p_lng double precision)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_min double precision;
begin
  if not p_nfc.require_location or not private.tiene_sede_con_ubicacion(p_nfc.business_id) then return; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'LOCATION_REQUIRED';
  end if;
  select min(private.metros_entre(p_lat, p_lng, latitude, longitude)) into v_min
  from public.locations where business_id = p_nfc.business_id and active and latitude is not null;
  if v_min is null or v_min > p_nfc.radius_m then raise exception 'TOO_FAR'; end if;
end;
$$;

-- ---------- Registrar visita por toque NFC (solo el servidor) ----------
drop function public.register_nfc_visit(text, text, text, text);
create function public.register_nfc_visit(
  p_slug text,
  p_secret text,
  p_card_token text,
  p_idempotency_key text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_nfc      private.business_nfc;
  v_card     public.loyalty_cards;
  v_result   jsonb;
  v_hoy      integer;
begin
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  if v_business.status = 'suspended' then raise exception 'BUSINESS_SUSPENDED'; end if;

  select * into v_nfc from private.business_nfc where business_id = v_business.id;
  if not found or not v_nfc.enabled then raise exception 'NFC_DISABLED'; end if;
  if p_secret is null or p_secret <> v_nfc.secret then raise exception 'INVALID_TAG'; end if;

  select * into v_card from public.loyalty_cards
  where public_token = p_card_token and business_id = v_business.id;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;

  -- Un reintento de un toque ya registrado sigue de largo: record_visit lo reconoce por su clave.
  if not exists (select 1 from public.visits where business_id = v_business.id and idempotency_key = p_idempotency_key) then
    perform private.nfc_comprobar_ubicacion(v_nfc, p_lat, p_lng);

    -- Sellos por NFC de hoy (día del comercio), sin contar los que se revirtieron.
    select count(*) into v_hoy
    from public.visits v
    where v.card_id = v_card.id and v.kind = 'visit' and v.source = 'nfc'
      and v.created_at >= (date_trunc('day', now() at time zone v_business.timezone) at time zone v_business.timezone)
      and not exists (select 1 from public.visits r where r.reverses_visit_id = v.id);
    if v_hoy >= v_nfc.max_per_day then raise exception 'NFC_DAILY_LIMIT'; end if;
  end if;

  v_result := private.record_visit(v_card.id, p_idempotency_key, null, null, 'nfc', v_nfc.min_minutes);
  return v_result || jsonb_build_object('card_id', v_card.id, 'business_id', v_business.id);
end;
$$;
revoke all on function public.register_nfc_visit(text, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.register_nfc_visit(text, text, text, text, double precision, double precision) to service_role;

-- ---------- Sello escribiendo el celular ----------
drop function public.register_nfc_visit_by_phone(text, text, text, text, text);
create function public.register_nfc_visit_by_phone(
  p_slug text,
  p_secret text,
  p_phone_e164 text,
  p_idempotency_key text,
  p_client_key text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_nfc      private.business_nfc;
  v_token    text;
begin
  -- 1. La etiqueta. Cualquier falla da el mismo error y no se mira el número.
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found or v_business.status = 'suspended' then raise exception 'INVALID_TAG'; end if;
  select * into v_nfc from private.business_nfc where business_id = v_business.id;
  if not found or not v_nfc.enabled or p_secret is null or p_secret <> v_nfc.secret then
    raise exception 'INVALID_TAG';
  end if;

  -- 2. La ubicación, antes de mirar el número: lejos del local no se aprende nada sobre ningún celular.
  perform private.nfc_comprobar_ubicacion(v_nfc, p_lat, p_lng);

  -- 3. Límite de intentos (los fallidos también cuentan: por eso no se lanza error al no encontrar).
  delete from private.nfc_phone_attempts where created_at < now() - interval '1 day';
  if (select count(*) from private.nfc_phone_attempts
      where client_key = coalesce(p_client_key, '') and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from private.nfc_phone_attempts
         where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into private.nfc_phone_attempts (client_key, business_id) values (coalesce(p_client_key, ''), v_business.id);

  -- 4. El número. No existe, bloqueada o datos borrados: misma respuesta.
  select c.public_token into v_token
  from public.customers cu
  join public.loyalty_cards c on c.customer_id = cu.id
  where cu.business_id = v_business.id
    and cu.phone_e164 = p_phone_e164
    and cu.anonymized_at is null
    and c.status <> 'blocked'
  order by c.created_at desc
  limit 1;
  if v_token is null then
    return jsonb_build_object('error', 'PHONE_NOT_FOUND');
  end if;

  -- 5. La visita, con las reglas de siempre (límite del día, tiempo mínimo, promociones, premios).
  return public.register_nfc_visit(p_slug, p_secret, v_token, p_idempotency_key, p_lat, p_lng);
end;
$$;
revoke all on function public.register_nfc_visit_by_phone(text, text, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.register_nfc_visit_by_phone(text, text, text, text, text, double precision, double precision) to service_role;

-- ---------- Ajustes de NFC en el panel ----------
create or replace function public.get_nfc_settings(p_business_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_nfc private.business_nfc;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  insert into private.business_nfc (business_id) values (p_business_id) on conflict (business_id) do nothing;
  select * into v_nfc from private.business_nfc where business_id = p_business_id;
  return jsonb_build_object('enabled', v_nfc.enabled, 'secret', v_nfc.secret, 'min_minutes', v_nfc.min_minutes,
                            'max_per_day', v_nfc.max_per_day, 'require_location', v_nfc.require_location,
                            'can_require_location', private.tiene_sede_con_ubicacion(p_business_id));
end;
$$;

drop function public.set_nfc_settings(uuid, boolean, integer, boolean);
create function public.set_nfc_settings(
  p_business_id uuid,
  p_enabled boolean,
  p_min_minutes integer,
  p_rotate boolean default false,
  p_max_per_day integer default null,
  p_require_location boolean default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path = ''
as $$
declare
  v_nfc private.business_nfc;
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_min_minutes is null or p_min_minutes not between 0 and 1440 then raise exception 'INVALID_NFC_SETTINGS'; end if;
  if p_max_per_day is not null and p_max_per_day not between 1 and 20 then raise exception 'INVALID_NFC_SETTINGS'; end if;
  if coalesce(p_require_location, false) and not private.tiene_sede_con_ubicacion(p_business_id) then
    raise exception 'NFC_NEEDS_LOCATION';
  end if;

  insert into private.business_nfc (business_id) values (p_business_id) on conflict (business_id) do nothing;
  update private.business_nfc
  set enabled          = coalesce(p_enabled, false),
      min_minutes      = p_min_minutes,
      max_per_day      = coalesce(p_max_per_day, max_per_day),
      require_location = coalesce(p_require_location, require_location),
      secret           = case when coalesce(p_rotate, false) then private.generate_public_token() else secret end,
      updated_at       = now()
  where business_id = p_business_id
  returning * into v_nfc;

  -- El secreto nunca va a la auditoría.
  perform private.audit(p_business_id, 'nfc.settings', 'business', p_business_id::text,
                        jsonb_build_object('enabled', v_nfc.enabled, 'min_minutes', v_nfc.min_minutes,
                                           'max_per_day', v_nfc.max_per_day, 'require_location', v_nfc.require_location,
                                           'secret_rotated', coalesce(p_rotate, false)));
  return jsonb_build_object('enabled', v_nfc.enabled, 'secret', v_nfc.secret, 'min_minutes', v_nfc.min_minutes,
                            'max_per_day', v_nfc.max_per_day, 'require_location', v_nfc.require_location,
                            'can_require_location', private.tiene_sede_con_ubicacion(p_business_id));
end;
$$;
revoke all on function public.set_nfc_settings(uuid, boolean, integer, boolean, integer, boolean) from public, anon, authenticated;
grant execute on function public.set_nfc_settings(uuid, boolean, integer, boolean, integer, boolean) to authenticated;
grant execute on function public.get_nfc_settings(uuid) to authenticated;
