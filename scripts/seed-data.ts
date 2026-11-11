// Convierte los datos de prueba (scripts/datos-prueba.ts) en filas para Postgres.
// Lo usan scripts/seed.ts (Supabase real) y scripts/test-db.mjs (validación local).
import { createHash } from "node:crypto";
import * as demo from "./datos-prueba.ts";

/** UUID determinista a partir de un ID de demo (estable entre ejecuciones). */
export function uuidFor(id: string): string {
  const h = createHash("sha1").update(`loyalty-demo:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const demoUsers = demo.profiles.map((p) => ({
  demoId: p.id,
  email: p.email,
  fullName: p.fullName,
  superadmin: p.platformRole === "superadmin",
}));

/** Filas por tabla. `profileIds` mapea el ID de demo del perfil al ID real de auth.users. */
export function buildSeed(profileIds: Record<string, string>) {
  const pid = (id: string) => {
    const v = profileIds[id];
    if (!v) throw new Error(`Falta el usuario de Auth para ${id}`);
    return v;
  };
  const phone = (p: string) => p.replace(/[^\d+]/g, "");

  const businesses = demo.businesses.map((b) => ({
    id: uuidFor(b.id),
    slug: b.slug,
    name: b.name,
    category: b.category,
    city: b.city,
    status: b.status,
    plan_id: b.planId,
    branding: b.branding,
    timezone: b.timezone,
    created_at: b.createdAt,
  }));

  // Beauty Club trae su programa; el resto recibe uno genérico para que su /join funcione.
  const programs = demo.businesses.map((b) => {
    const p = demo.programs.find((x) => x.businessId === b.id);
    return {
      id: uuidFor(p?.id ?? `prg_${b.id}`),
      business_id: uuidFor(b.id),
      name: p?.name ?? b.name,
      description: p?.description ?? "",
      stamps_required: p?.stampsRequired ?? 8,
      reward_name: p?.rewardName ?? "Recompensa de cortesía",
      reward_description: p?.rewardDescription ?? "",
      min_minutes_between_visits: p?.minMinutesBetweenVisits ?? 60,
      reward_expiry_days: p?.rewardExpiryDays ?? null,
      terms: p?.terms ?? "",
      active: true,
      created_at: p?.createdAt ?? b.createdAt,
    };
  });

  const memberships = demo.memberships.map((m) => ({
    id: uuidFor(m.id),
    business_id: uuidFor(m.businessId),
    profile_id: pid(m.profileId),
    role: m.role,
    can_redeem: m.canRedeem,
    active: m.active,
    created_at: m.createdAt,
  }));

  const customers = demo.customers.map((c) => ({
    id: uuidFor(c.id),
    business_id: uuidFor(c.businessId),
    full_name: c.fullName,
    phone_e164: phone(c.phone),
    email: c.email ?? null,
    terms_accepted_at: c.termsAcceptedAt,
    marketing_consent: c.marketingConsent,
    marketing_consent_at: c.marketingConsentAt ?? null,
    created_at: c.createdAt,
  }));

  const cards = demo.cards.map((c) => ({
    id: uuidFor(c.id),
    business_id: uuidFor(c.businessId),
    program_id: uuidFor(c.programId),
    customer_id: uuidFor(c.customerId),
    public_token: c.publicToken,
    status: c.status,
    current_stamps: c.currentStamps,
    total_visits: c.totalVisits,
    last_visit_at: c.lastVisitAt ?? null,
    created_at: c.createdAt,
  }));

  // Primero las visitas, después las reversiones (que las referencian).
  const visits = [...demo.visits]
    .sort((a, b) => (a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === "visit" ? -1 : 1))
    .map((v) => ({
      id: uuidFor(v.id),
      business_id: uuidFor(v.businessId),
      card_id: uuidFor(v.cardId),
      kind: v.kind,
      delta: v.delta,
      reverses_visit_id: v.reversesVisitId ? uuidFor(v.reversesVisitId) : null,
      reason: v.reason ?? null,
      staff_id: pid(v.staffId),
      idempotency_key: v.idempotencyKey,
      created_at: v.createdAt,
    }));

  const rewards = demo.rewards.map((r) => ({
    id: uuidFor(r.id),
    business_id: uuidFor(r.businessId),
    card_id: uuidFor(r.cardId),
    program_id: uuidFor(r.programId),
    source_visit_id: uuidFor(r.id.replace(/^rwd_/, "")),
    name: r.name,
    status: r.status,
    earned_at: r.earnedAt,
    expires_at: r.expiresAt ?? null,
  }));

  const redemptions = demo.redemptions.map((r) => ({
    id: uuidFor(r.id),
    business_id: uuidFor(r.businessId),
    reward_id: uuidFor(r.rewardId),
    card_id: uuidFor(r.cardId),
    staff_id: pid(r.staffId),
    created_at: r.createdAt,
  }));

  return { businesses, loyalty_programs: programs, business_memberships: memberships, customers, loyalty_cards: cards, visits, rewards, redemptions };
}

export type SeedRows = ReturnType<typeof buildSeed>;
export const SEED_ORDER: (keyof SeedRows)[] = [
  "businesses",
  "loyalty_programs",
  "business_memberships",
  "customers",
  "loyalty_cards",
  "visits",
  "rewards",
  "redemptions",
];
