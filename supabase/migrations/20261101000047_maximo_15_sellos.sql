-- =====================================================================
-- Máximo 15 sellos por tarjeta (antes 30).
--  * Con más sellos la tarjeta pierde gracia y los sellos se ven pequeños en la Wallet.
--  * Ningún programa en producción tenía más de 15 al aplicar esta migración (revisado el
--    26-nov-2026: 10, 5 y 5). Si alguno tuviera más, la migración falla y no cambia nada.
--  * El panel y el servidor ya limitan a 15; esto lo asegura también en la base de datos.
-- =====================================================================

alter table public.loyalty_programs drop constraint if exists loyalty_programs_stamps_required_check;
alter table public.loyalty_programs add constraint loyalty_programs_stamps_required_check
  check (stamps_required between 2 and 15);
