-- =====================================================================
-- Toque NFC sumando el sello solo con el celular, ahora dentro de Postgres.
-- Antes la app buscaba el número ANTES de comprobar la etiqueta y respondía distinto si existía:
-- desde cualquier lugar se podía averiguar si un celular era cliente de un comercio (Ley 1581).
-- Ahora:
--  * Primero se comprueba la etiqueta (comercio activo, NFC encendido y secreto correcto). Si algo
--    falla, el error es siempre INVALID_TAG, sin mirar el número.
--  * Límite de intentos guardado en la base (no en la memoria del servidor): por conexión (HMAC de
--    la IP, nunca la IP) y por comercio. Los intentos fallidos también cuentan.
--  * Número que no existe, tarjeta bloqueada o datos borrados: la misma respuesta (PHONE_NOT_FOUND).
--  * Solo la service_role (el servidor de la app) puede llamarla.
-- =====================================================================

create table private.nfc_phone_attempts (
  client_key  text not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index nfc_phone_attempts_key_idx on private.nfc_phone_attempts (client_key, created_at);
create index nfc_phone_attempts_business_idx on private.nfc_phone_attempts (business_id, created_at);
create index nfc_phone_attempts_created_idx on private.nfc_phone_attempts (created_at);

create function public.register_nfc_visit_by_phone(
  p_slug text,
  p_secret text,
  p_phone_e164 text,
  p_idempotency_key text,
  p_client_key text
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

  -- 2. Límite de intentos (los fallidos también cuentan: por eso no se lanza error al no encontrar).
  delete from private.nfc_phone_attempts where created_at < now() - interval '1 day';
  if (select count(*) from private.nfc_phone_attempts
      where client_key = coalesce(p_client_key, '') and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from private.nfc_phone_attempts
         where business_id = v_business.id and created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into private.nfc_phone_attempts (client_key, business_id) values (coalesce(p_client_key, ''), v_business.id);

  -- 3. El número. No existe, bloqueada o datos borrados: misma respuesta.
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

  -- 4. La visita, con las reglas de siempre (tiempo mínimo, promociones, premios).
  return public.register_nfc_visit(p_slug, p_secret, v_token, p_idempotency_key);
end;
$$;

revoke all on function public.register_nfc_visit_by_phone(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_nfc_visit_by_phone(text, text, text, text, text) to service_role;
