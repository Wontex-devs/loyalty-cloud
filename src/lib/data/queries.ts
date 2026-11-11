import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DemoState } from "@/lib/demo/store";
import * as m from "./mappers";
import { fetchAll } from "./fetch-all";

/**
 * Lecturas del servidor. Siempre con el cliente de la sesión del usuario:
 * el aislamiento entre comercios lo garantiza RLS, no estos filtros.
 */

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("business_memberships")
      .select("*, businesses(slug, name, status)")
      .eq("profile_id", user.id)
      .eq("active", true),
  ]);

  return {
    user,
    profile: profile ? m.toProfile(profile) : null,
    memberships: (memberships ?? []).map((x) => ({
      ...m.toMembership(x),
      business: x.businesses as { slug: string; name: string; status: string } | null,
    })),
  };
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Destino tras iniciar sesión según el rol. */
export function homePathFor(session: Session) {
  if (session.profile?.platformRole === "superadmin") return "/admin";
  const first = session.memberships.find((x) => x.business);
  if (!first?.business) return "/account/no-access";
  return first.role === "staff" ? `/business/${first.business.slug}/customers` : `/business/${first.business.slug}`;
}

const MAX_ROWS = 10000;

/** Todo lo que el panel del comercio necesita, filtrado por RLS. */
export async function loadBusinessSnapshot(slug: string, session: Session): Promise<DemoState | null> {
  const supabase = await createClient();
  const { data: biz } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle();
  if (!biz) return null;
  const id = biz.id as string;

  // Las tablas que crecen se piden por páginas (Supabase limita a 1000 filas por consulta).
  const [plans, programs, customers, cards, visits, rewards, redemptions, memberships, profiles, audit, promotions, contacts, locations, walletNotices] = await Promise.all([
    supabase.from("plans").select("*"),
    supabase.from("loyalty_programs").select("*").eq("business_id", id),
    fetchAll((f, t) => supabase.from("customers").select("*").eq("business_id", id).order("created_at").range(f, t), MAX_ROWS),
    fetchAll((f, t) => supabase.from("loyalty_cards").select("*").eq("business_id", id).order("created_at").range(f, t), MAX_ROWS),
    fetchAll((f, t) => supabase.from("visits").select("*").eq("business_id", id).order("created_at", { ascending: false }).range(f, t), MAX_ROWS),
    fetchAll((f, t) => supabase.from("rewards").select("*").eq("business_id", id).order("earned_at", { ascending: false }).range(f, t), MAX_ROWS),
    fetchAll((f, t) => supabase.from("redemptions").select("*").eq("business_id", id).order("created_at", { ascending: false }).range(f, t), MAX_ROWS),
    supabase.from("business_memberships").select("*").eq("business_id", id),
    supabase.from("profiles").select("*"),
    supabase.from("audit_logs").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(300),
    supabase.from("promotions").select("*").eq("business_id", id).order("starts_on", { ascending: false }).limit(200),
    // Solo owner/admin pueden leerlos (RLS); para el resto llega vacío.
    supabase.from("customer_contacts").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(5000),
    supabase.from("locations").select("*").eq("business_id", id).order("created_at"),
    // Igual que los contactos: solo owner/admin.
    supabase.from("wallet_notifications").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(1000),
  ]);

  return {
    businesses: [m.toBusiness(biz)],
    plans: (plans.data ?? []).map(m.toPlan),
    businessStats: {},
    programs: (programs.data ?? []).map(m.toProgram),
    customers: customers.map(m.toCustomer),
    cards: cards.map(m.toCard),
    visits: visits.map(m.toVisit),
    rewards: rewards.map(m.toReward),
    redemptions: redemptions.map(m.toRedemption),
    memberships: (memberships.data ?? []).map(m.toMembership),
    profiles: (profiles.data ?? []).map(m.toProfile),
    auditLogs: (audit.data ?? []).map(m.toAuditLog),
    promotions: (promotions.data ?? []).map(m.toPromotion),
    contacts: (contacts.data ?? []).map(m.toContact),
    locations: (locations.data ?? []).map(m.toLocation),
    walletNotices: (walletNotices.data ?? []).map(m.toWalletNotice),
    actingProfileId: session.user.id,
  };
}

/** Datos de plataforma para el superadmin (sin datos personales de clientes). */
export async function loadPlatformSnapshot(session: Session): Promise<DemoState> {
  const supabase = await createClient();
  const [businesses, plans, profiles, memberships, audit, stats] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at"),
    supabase.from("plans").select("*").order("price_monthly"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("business_memberships").select("*"),
    supabase.from("audit_logs").select("*").is("business_id", null).order("created_at", { ascending: false }).limit(50),
    supabase.rpc("platform_business_stats"),
  ]);

  const businessStats: DemoState["businessStats"] = {};
  for (const s of (stats.data ?? []) as { business_id: string; customers: number; visits_30d: number; redemptions_30d: number }[]) {
    businessStats[s.business_id] = { customers: Number(s.customers), visits30d: Number(s.visits_30d), rewards30d: Number(s.redemptions_30d) };
  }

  return {
    businesses: (businesses.data ?? []).map(m.toBusiness),
    plans: (plans.data ?? []).map(m.toPlan),
    businessStats,
    programs: [],
    customers: [],
    cards: [],
    visits: [],
    rewards: [],
    redemptions: [],
    memberships: (memberships.data ?? []).map(m.toMembership),
    profiles: (profiles.data ?? []).map(m.toProfile),
    auditLogs: (audit.data ?? []).map(m.toAuditLog),
    promotions: [],
    contacts: [],
    locations: [],
    walletNotices: [],
    actingProfileId: session.user.id,
  };
}
