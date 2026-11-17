-- =====================================================================
-- Etapa 25 · Ubicación de cada sede (aviso de cercanía en la billetera)
--  * Cada sede puede guardar su latitud y longitud. Con ellas, el pase de Apple Wallet
--    y el programa de Google Wallet llevan la ubicación del local: el celular del
--    cliente muestra la tarjeta (iPhone) o un aviso (Android) al estar cerca.
--  * Lazo no recibe ni guarda la ubicación del cliente: el cálculo lo hace su celular.
--  * Van las dos o ninguna; sin ellas la sede no da aviso de cercanía.
--  * Las políticas de la tabla no cambian (propietario y administrador editan).
-- =====================================================================

alter table public.locations
  add column if not exists latitude  double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180);

alter table public.locations drop constraint if exists locations_coords_pair;
alter table public.locations add constraint locations_coords_pair
  check ((latitude is null) = (longitude is null));
