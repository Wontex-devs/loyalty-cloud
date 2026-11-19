-- =====================================================================
-- Código de barras de la tarjeta: cada tarjeta tiene un número de 12 dígitos para escanearlo
-- con la cámara del panel (o escribirlo a mano). No es el enlace de la tarjeta: con una foto
-- del código no se abre nada; solo el equipo del comercio, con sesión, lo convierte en visita.
--  * loyalty_cards.scan_code: 12 dígitos, único, se crea solo con cada tarjeta nueva.
--  * Las tarjetas que ya existen reciben el suyo.
--  * get_public_card devuelve 'scan_code' (para dibujarlo en la tarjeta y en el pase).
-- =====================================================================

create function private.generate_scan_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad((floor(random() * 1e12))::bigint::text, 12, '0');
$$;
revoke all on function private.generate_scan_code() from public, anon, authenticated;

alter table public.loyalty_cards add column scan_code text;

-- Las tarjetas existentes reciben su código, sin repetir.
do $$
declare
  r record;
  v text;
begin
  for r in select id from public.loyalty_cards where scan_code is null loop
    loop
      v := private.generate_scan_code();
      exit when not exists (select 1 from public.loyalty_cards where scan_code = v);
    end loop;
    update public.loyalty_cards set scan_code = v where id = r.id;
  end loop;
end
$$;

alter table public.loyalty_cards
  alter column scan_code set default private.generate_scan_code(),
  alter column scan_code set not null,
  add constraint loyalty_cards_scan_code_format check (scan_code ~ '^[0-9]{12}$');
create unique index loyalty_cards_scan_code_key on public.loyalty_cards (scan_code);

create or replace function public.get_public_card(p_token text)
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'token', c.public_token,
    'scan_code', c.scan_code,
    'status', c.status,
    'current_stamps', c.current_stamps,
    'total_visits', c.total_visits,
    'member_since', cu.created_at,
    'customer_name', cu.full_name,
    'marketing_consent', cu.marketing_consent,
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'branding', b.branding),
    'program', jsonb_build_object('name', p.name, 'stamps_required', p.stamps_required,
                                  'reward_name', p.reward_name, 'terms', p.terms),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'kind', r.kind, 'earned_at', r.earned_at, 'expires_at', r.expires_at)
                       order by r.earned_at)
      from public.rewards r
      where r.card_id = c.id and r.status = 'available'
        and (r.expires_at is null or r.expires_at > now())
    ), '[]'::jsonb),
    'promotion', (select jsonb_build_object('name', pr.name, 'bonus_stamps', pr.bonus_stamps, 'ends_on', pr.ends_on)
                  from private.active_promotion(c.business_id) pr where pr.id is not null),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('kind', v.kind, 'delta', v.delta, 'bonus', v.bonus_stamps, 'created_at', v.created_at)
                       order by v.created_at desc)
      from (select * from public.visits where card_id = c.id order by created_at desc limit 5) v
    ), '[]'::jsonb)
  )
  from public.loyalty_cards c
  join public.customers cu on cu.id = c.customer_id
  join public.businesses b on b.id = c.business_id
  join public.loyalty_programs p on p.id = c.program_id
  where c.public_token = p_token
    and b.status <> 'suspended'
    and cu.anonymized_at is null;
$$;
