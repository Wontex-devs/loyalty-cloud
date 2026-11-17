-- =====================================================================
-- Etapa 20 · Apple Wallet
--  * Cada iPhone que guarda un pase se registra en nuestro servicio web (protocolo de Apple):
--    se guarda su identificador de dispositivo y el token para avisarle por APNs.
--  * pass_updated_at marca cuándo cambió el pase: el iPhone pregunta «qué cambió desde…».
--  * Solo el servidor (service_role) lee y escribe: el panel no necesita estos datos.
--  * Al borrar la tarjeta (o el comercio) se borran sus registros.
-- =====================================================================

create table if not exists public.apple_wallet_registrations (
  device_library_id text not null check (length(device_library_id) between 1 and 128),
  card_id           uuid not null,
  business_id       uuid not null,
  push_token        text not null check (length(push_token) between 1 and 200),
  pass_updated_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  primary key (device_library_id, card_id),
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade
);
create index if not exists apple_wallet_registrations_card_idx on public.apple_wallet_registrations (card_id);
create index if not exists apple_wallet_registrations_business_idx on public.apple_wallet_registrations (business_id);

alter table public.apple_wallet_registrations enable row level security;
revoke all on public.apple_wallet_registrations from public, anon, authenticated;
grant all on public.apple_wallet_registrations to service_role;
