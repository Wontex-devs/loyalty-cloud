-- =====================================================================
-- Etapa 2 · Row Level Security
-- Principios:
--  * Sin políticas para `anon`: el público solo accede mediante RPC acotadas.
--  * Lectura de datos operativos: miembros activos del comercio.
--  * El superadmin ve comercios, planes, usuarios y agregados, pero NO los
--    datos personales de los clientes finales (customers/cards/visits).
--  * Visitas, recompensas, canjes y tarjetas no se escriben directamente:
--    solo mediante funciones transaccionales (ver 0003_functions.sql).
-- =====================================================================

-- ---------- Funciones de autorización (SECURITY DEFINER evita recursión en RLS) ----------
create function private.is_superadmin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'superadmin'
  );
$$;

create function private.is_member(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships
    where business_id = p_business and profile_id = auth.uid() and active
  );
$$;

create function private.has_role(p_business uuid, p_roles public.business_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships
    where business_id = p_business and profile_id = auth.uid() and active and role = any (p_roles)
  );
$$;

create function private.can_redeem(p_business uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships
    where business_id = p_business and profile_id = auth.uid() and active
      and (role in ('owner', 'admin') or can_redeem)
  );
$$;

create function private.shares_business(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships mine
    join public.business_memberships theirs on theirs.business_id = mine.business_id
    where mine.profile_id = auth.uid() and mine.active and theirs.profile_id = p_profile
  );
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function
  private.is_superadmin(),
  private.is_member(uuid),
  private.has_role(uuid, public.business_role[]),
  private.can_redeem(uuid),
  private.shares_business(uuid)
to authenticated;

-- ---------- Activar RLS en todas las tablas ----------
alter table public.plans                enable row level security;
alter table public.businesses           enable row level security;
alter table public.profiles             enable row level security;
alter table public.business_memberships enable row level security;
alter table public.loyalty_programs     enable row level security;
alter table public.customers            enable row level security;
alter table public.loyalty_cards        enable row level security;
alter table public.visits               enable row level security;
alter table public.rewards              enable row level security;
alter table public.redemptions          enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.campaigns            enable row level security;

-- Privilegios base: anon no toca tablas; authenticated depende de las políticas.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.business_memberships to authenticated;
grant insert, update on public.loyalty_programs to authenticated;
grant update (full_name, email) on public.customers to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert, update, delete on public.campaigns to authenticated;
grant insert, update on public.plans to authenticated;
-- service_role (solo servidor: semilla e invitaciones) necesita privilegios explícitos
-- porque el proyecto no expone tablas automáticamente.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- plans ----------
create policy plans_read on public.plans for select to authenticated using (true);
create policy plans_write on public.plans for insert to authenticated with check (private.is_superadmin());
create policy plans_update on public.plans for update to authenticated
  using (private.is_superadmin()) with check (private.is_superadmin());

-- ---------- businesses (escritura solo vía RPC) ----------
create policy businesses_read on public.businesses for select to authenticated
  using (private.is_member(id) or private.is_superadmin());

-- ---------- profiles ----------
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_superadmin() or private.shares_business(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- business_memberships ----------
create policy memberships_read on public.business_memberships for select to authenticated
  using (profile_id = auth.uid() or private.is_member(business_id) or private.is_superadmin());

-- Owner/admin gestionan empleados, pero nunca crean ni modifican al propietario.
create policy memberships_insert on public.business_memberships for insert to authenticated
  with check (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner')
  );
create policy memberships_update on public.business_memberships for update to authenticated
  using (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner' and profile_id <> auth.uid())
  )
  with check (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner')
  );
create policy memberships_delete on public.business_memberships for delete to authenticated
  using (
    private.is_superadmin()
    or (private.has_role(business_id, '{owner,admin}') and role <> 'owner' and profile_id <> auth.uid())
  );

-- ---------- loyalty_programs ----------
create policy programs_read on public.loyalty_programs for select to authenticated
  using (private.is_member(business_id) or private.is_superadmin());
create policy programs_insert on public.loyalty_programs for insert to authenticated
  with check (private.has_role(business_id, '{owner,admin}') or private.is_superadmin());
create policy programs_update on public.loyalty_programs for update to authenticated
  using (private.has_role(business_id, '{owner,admin}') or private.is_superadmin())
  with check (private.has_role(business_id, '{owner,admin}') or private.is_superadmin());

-- ---------- customers (datos personales: solo el comercio) ----------
create policy customers_read on public.customers for select to authenticated
  using (private.is_member(business_id));
create policy customers_update on public.customers for update to authenticated
  using (private.has_role(business_id, '{owner,admin}'))
  with check (private.has_role(business_id, '{owner,admin}'));

-- ---------- loyalty_cards / visits / rewards / redemptions (solo lectura) ----------
create policy cards_read on public.loyalty_cards for select to authenticated
  using (private.is_member(business_id));
create policy visits_read on public.visits for select to authenticated
  using (private.is_member(business_id));
create policy rewards_read on public.rewards for select to authenticated
  using (private.is_member(business_id));
create policy redemptions_read on public.redemptions for select to authenticated
  using (private.is_member(business_id));

-- ---------- audit_logs ----------
create policy audit_read on public.audit_logs for select to authenticated
  using (
    (business_id is not null and private.has_role(business_id, '{owner,admin}'))
    or private.is_superadmin()
  );

-- ---------- campaigns (futuro) ----------
create policy campaigns_read on public.campaigns for select to authenticated
  using (private.is_member(business_id));
create policy campaigns_write on public.campaigns for all to authenticated
  using (private.has_role(business_id, '{owner,admin}'))
  with check (private.has_role(business_id, '{owner,admin}'));
