/** Conversión filas de Postgres (snake_case) → modelo de dominio (camelCase). */
import type {
  AuditLog,
  Business,
  BusinessMembership,
  Customer,
  CustomerContact,
  Location,
  LoyaltyCard,
  LoyaltyProgram,
  Plan,
  Profile,
  Promotion,
  Redemption,
  Reward,
  Visit,
} from "@/lib/domain/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const opt = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

export const toPlan = (r: Row): Plan => ({
  id: r.id,
  name: r.name,
  priceMonthly: r.price_monthly,
  currency: r.currency,
  maxCustomers: r.max_customers,
  maxStaff: r.max_staff,
  maxPrograms: r.max_programs,
  maxLocations: r.max_locations ?? null,
  features: r.features ?? [],
});

export const toBusiness = (r: Row): Business => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  category: r.category,
  city: r.city,
  status: r.status,
  planId: r.plan_id,
  timezone: r.timezone,
  legal: {
    legalName: opt(r.legal_name),
    taxId: opt(r.tax_id),
    contactEmail: opt(r.contact_email),
    contactPhone: opt(r.contact_phone),
    address: opt(r.address),
  },
  createdAt: r.created_at,
  branding: {
    logoText: "",
    primary: "#111111",
    primaryForeground: "#FFFFFF",
    accent: "#D8A7A7",
    cardBackground: "#EBCFCB",
    cardForeground: "#1A1416",
    ...(r.branding ?? {}),
  },
});

export const toProfile = (r: Row): Profile => ({
  id: r.id,
  fullName: r.full_name || r.email,
  email: r.email,
  platformRole: r.platform_role,
  createdAt: r.created_at,
});

export const toMembership = (r: Row): BusinessMembership => ({
  id: r.id,
  businessId: r.business_id,
  profileId: r.profile_id,
  role: r.role,
  canRedeem: r.can_redeem,
  active: r.active,
  createdAt: r.created_at,
});

export const toProgram = (r: Row): LoyaltyProgram => ({
  id: r.id,
  businessId: r.business_id,
  name: r.name,
  description: r.description,
  stampsRequired: r.stamps_required,
  rewardName: r.reward_name,
  rewardDescription: r.reward_description,
  minMinutesBetweenVisits: r.min_minutes_between_visits,
  rewardExpiryDays: r.reward_expiry_days,
  welcomeStamps: r.welcome_stamps ?? 0,
  birthdayReward: r.birthday_reward ?? null,
  terms: r.terms,
  active: r.active,
  createdAt: r.created_at,
});

export const toCustomer = (r: Row): Customer => ({
  id: r.id,
  businessId: r.business_id,
  fullName: r.full_name,
  phone: r.phone_e164 ?? "",
  email: opt(r.email),
  birthMonth: opt(r.birth_month),
  birthDay: opt(r.birth_day),
  termsAcceptedAt: r.terms_accepted_at,
  marketingConsent: r.marketing_consent,
  marketingConsentAt: opt(r.marketing_consent_at),
  anonymizedAt: opt(r.anonymized_at),
  createdAt: r.created_at,
});

export const toCard = (r: Row): LoyaltyCard => ({
  id: r.id,
  businessId: r.business_id,
  programId: r.program_id,
  customerId: r.customer_id,
  publicToken: r.public_token,
  status: r.status,
  currentStamps: r.current_stamps,
  totalVisits: r.total_visits,
  lastVisitAt: opt(r.last_visit_at),
  createdAt: r.created_at,
});

export const toVisit = (r: Row): Visit => ({
  id: r.id,
  businessId: r.business_id,
  cardId: r.card_id,
  kind: r.kind,
  delta: r.delta,
  reversesVisitId: opt(r.reverses_visit_id),
  reason: opt(r.reason),
  staffId: r.staff_id ?? "",
  idempotencyKey: r.idempotency_key,
  bonusStamps: r.bonus_stamps ?? 0,
  promotionId: opt(r.promotion_id),
  locationId: opt(r.location_id),
  createdAt: r.created_at,
});

export const toReward = (r: Row): Reward => ({
  id: r.id,
  businessId: r.business_id,
  cardId: r.card_id,
  programId: r.program_id,
  name: r.name,
  kind: r.kind ?? "cycle",
  // El vencimiento se calcula al leer: una disponible con fecha pasada ya está vencida.
  status: r.status === "available" && r.expires_at && new Date(r.expires_at).getTime() <= Date.now() ? "expired" : r.status,
  earnedAt: r.earned_at,
  expiresAt: opt(r.expires_at),
});

export const toRedemption = (r: Row): Redemption => ({
  id: r.id,
  businessId: r.business_id,
  rewardId: r.reward_id,
  cardId: r.card_id,
  staffId: r.staff_id ?? "",
  createdAt: r.created_at,
});

export const toPromotion = (r: Row): Promotion => ({
  id: r.id,
  businessId: r.business_id,
  name: r.name,
  bonusStamps: r.bonus_stamps,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  weekdays: r.weekdays ?? [1, 2, 3, 4, 5, 6, 7],
  active: r.active,
  createdAt: r.created_at,
});

export const toLocation = (r: Row): Location => ({
  id: r.id,
  businessId: r.business_id,
  name: r.name,
  address: opt(r.address),
  active: r.active,
  createdAt: r.created_at,
});

export const toContact = (r: Row): CustomerContact => ({
  id: r.id,
  businessId: r.business_id,
  customerId: r.customer_id,
  segment: r.segment,
  staffId: r.staff_id ?? "",
  createdAt: r.created_at,
});

export const toAuditLog = (r: Row): AuditLog => ({
  id: String(r.id),
  businessId: r.business_id,
  actorId: r.actor_id,
  action: r.action,
  entity: r.entity,
  entityId: r.entity_id,
  metadata: r.metadata,
  createdAt: r.created_at,
});
