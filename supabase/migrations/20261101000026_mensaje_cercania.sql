-- =====================================================================
-- Etapa 26 · Mensaje de cercanía editable
--  * El comercio escribe el texto que el iPhone muestra en la pantalla bloqueada
--    cuando el cliente está cerca de una sede (avisos automáticos → «Cerca del local»).
--  * Se guarda en businesses.wallet_notifications.nearbyText (opcional: sin él se usa
--    el texto por defecto). Entre 5 y 120 caracteres.
--  * Admite {nombre}, {comercio} y {progreso}; se reemplazan en cada pase.
-- =====================================================================

create or replace function private.valid_wallet_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k
                    where k not in ('stamp', 'near', 'reward', 'birthday', 'winback', 'winbackDays', 'nearbyText'))
    and jsonb_typeof(s -> 'stamp') = 'boolean'
    and jsonb_typeof(s -> 'near') = 'boolean'
    and jsonb_typeof(s -> 'reward') = 'boolean'
    and jsonb_typeof(s -> 'birthday') = 'boolean'
    and jsonb_typeof(s -> 'winback') = 'boolean'
    and jsonb_typeof(s -> 'winbackDays') = 'number'
    and (s ->> 'winbackDays') ~ '^[0-9]+$'
    and (s ->> 'winbackDays')::int between 14 and 180
    and (not (s ? 'nearbyText')
         or (jsonb_typeof(s -> 'nearbyText') = 'string'
             and length(btrim(s ->> 'nearbyText')) between 5 and 120));
$$;
