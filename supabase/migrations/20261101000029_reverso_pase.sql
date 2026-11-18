-- =====================================================================
-- Etapa 29 · Reverso del pase en la billetera
--  * El comercio agrega datos que el cliente ve al reverso del pase (Apple)
--    y en los enlaces del pase (Google): WhatsApp, Instagram, sitio web y horario.
--  * Se guardan en businesses.pass_info (jsonb). Todo es opcional.
--  * La dirección sale de los ajustes del comercio y de sus sedes; no se repite aquí.
--  * Solo propietario y administrador los cambian (update_pass_info).
-- =====================================================================

create or replace function private.valid_pass_info(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (select 1 from jsonb_object_keys(s) k where k not in ('whatsapp', 'instagram', 'website', 'hours'))
    and (not (s ? 'whatsapp') or (jsonb_typeof(s -> 'whatsapp') = 'string' and (s ->> 'whatsapp') ~ '^\+?[0-9]{7,15}$'))
    and (not (s ? 'instagram') or (jsonb_typeof(s -> 'instagram') = 'string' and (s ->> 'instagram') ~ '^[A-Za-z0-9._]{1,30}$'))
    and (not (s ? 'website') or (jsonb_typeof(s -> 'website') = 'string' and (s ->> 'website') ~ '^https://[^\s<>"]{3,200}$'))
    and (not (s ? 'hours') or (jsonb_typeof(s -> 'hours') = 'string' and length(btrim(s ->> 'hours')) between 3 and 300));
$$;

alter table public.businesses
  add column if not exists pass_info jsonb not null default '{}'::jsonb;
alter table public.businesses drop constraint if exists businesses_pass_info_valid;
alter table public.businesses add constraint businesses_pass_info_valid check (private.valid_pass_info(pass_info));

create or replace function public.update_pass_info(p_business_id uuid, p_info jsonb)
returns void
language plpgsql
volatile security definer
set search_path = ''
as $$
begin
  if not (private.has_role(p_business_id, '{owner,admin}') or private.is_superadmin()) then raise exception 'FORBIDDEN'; end if;
  if p_info is null or not private.valid_pass_info(p_info) then raise exception 'INVALID_PASS_INFO'; end if;
  update public.businesses set pass_info = p_info where id = p_business_id;
  perform private.audit(p_business_id, 'wallet.pass_info_updated', 'business', p_business_id::text, p_info);
end;
$$;

revoke all on function public.update_pass_info(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_pass_info(uuid, jsonb) to authenticated;
