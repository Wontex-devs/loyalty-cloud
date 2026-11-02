/**
 * Modelo de dominio. Refleja 1:1 las tablas previstas en Supabase (Etapa 2),
 * en camelCase. Todo registro operativo lleva `businessId` (tenant).
 */

export type ID = string;
export type ISODate = string;

export type PlatformRole = "superadmin" | "user";
export type BusinessRole = "owner" | "admin" | "staff";
export type BusinessStatus = "active" | "suspended" | "trial";
export type CardStatus = "active" | "reward_available" | "blocked";
export type RewardStatus = "available" | "redeemed" | "expired" | "void";
export type VisitKind = "visit" | "reversal";

export interface Plan {
  id: ID;
  name: string;
  priceMonthly: number;
  currency: string;
  maxCustomers: number | null;
  maxStaff: number | null;
  maxPrograms: number;
  /** Sedes activas permitidas (null = ilimitadas). */
  maxLocations: number | null;
  features: string[];
}

export interface Location {
  id: ID;
  businessId: ID;
  name: string;
  address?: string;
  active: boolean;
  createdAt: ISODate;
}

export interface BusinessBranding {
  logoText: string; // monograma mientras no hay logo subido (Supabase Storage en Etapa 2)
  logoUrl?: string;
  primary: string; // color de marca
  primaryForeground: string;
  accent: string;
  cardBackground: string;
  cardForeground: string;
}

export interface Business {
  id: ID;
  slug: string; // usado en /join/[slug]; único global
  name: string;
  category: string;
  city: string;
  status: BusinessStatus;
  planId: ID;
  branding: BusinessBranding;
  timezone: string;
  /** Responsable del tratamiento de datos (se muestra en la política pública). */
  legal: BusinessLegal;
  createdAt: ISODate;
}

export interface BusinessLegal {
  legalName?: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface Profile {
  id: ID; // = auth.users.id
  fullName: string;
  email: string;
  platformRole: PlatformRole;
  createdAt: ISODate;
}

export interface BusinessMembership {
  id: ID;
  businessId: ID;
  profileId: ID;
  role: BusinessRole;
  canRedeem: boolean; // permiso granular para empleados
  active: boolean;
  createdAt: ISODate;
}

export interface LoyaltyProgram {
  id: ID;
  businessId: ID;
  name: string;
  description: string;
  stampsRequired: number;
  rewardName: string;
  rewardDescription: string;
  /** Minutos mínimos entre dos visitas de la misma tarjeta (anti doble registro). */
  minMinutesBetweenVisits: number;
  rewardExpiryDays: number | null;
  /** Sellos de regalo con los que empieza cada tarjeta nueva (0 a 5, menos que la meta). */
  welcomeStamps: number;
  /** Regalo en la primera visita del mes de cumpleaños (null = sin regalo). */
  birthdayReward: string | null;
  terms: string;
  active: boolean;
  createdAt: ISODate;
}

export interface Customer {
  id: ID;
  businessId: ID;
  fullName: string;
  phone: string; // normalizado E.164; único por negocio
  email?: string;
  /** Cumpleaños opcional (sin año). */
  birthMonth?: number;
  birthDay?: number;
  termsAcceptedAt: ISODate;
  marketingConsent: boolean;
  marketingConsentAt?: ISODate;
  createdAt: ISODate;
}

export interface LoyaltyCard {
  id: ID;
  businessId: ID;
  programId: ID;
  customerId: ID;
  /** Token público aleatorio (≥128 bits). Es lo único que viaja en URL y QR. */
  publicToken: string;
  status: CardStatus;
  /** Sellos del ciclo actual (derivable del ledger de visitas; se cachea). */
  currentStamps: number;
  totalVisits: number;
  lastVisitAt?: ISODate;
  createdAt: ISODate;
}

export interface Visit {
  id: ID;
  businessId: ID;
  cardId: ID;
  kind: VisitKind;
  /** +1 para visita, -1 para reversión. Las visitas nunca se borran. */
  delta: 1 | -1;
  reversesVisitId?: ID;
  reason?: string;
  staffId: ID;
  /** Clave de idempotencia enviada por el cliente para evitar dobles registros. */
  idempotencyKey: string;
  /** Sellos extra por una promoción vigente (0 si no había). */
  bonusStamps?: number;
  promotionId?: ID;
  /** Sede donde se registró la visita (si el comercio usa sedes). */
  locationId?: ID;
  createdAt: ISODate;
}

export interface Promotion {
  id: ID;
  businessId: ID;
  name: string;
  /** Sellos extra por visita: 1 = doble sello. */
  bonusStamps: number;
  startsOn: string; // AAAA-MM-DD, zona horaria del comercio
  endsOn: string;
  /** Días ISO: 1 = lunes … 7 = domingo. */
  weekdays: number[];
  active: boolean;
  createdAt: ISODate;
}

/** Registro de un mensaje de WhatsApp enviado a mano por el equipo. */
export interface CustomerContact {
  id: ID;
  businessId: ID;
  customerId: ID;
  segment: string;
  staffId: ID;
  createdAt: ISODate;
}

export interface Reward {
  id: ID;
  businessId: ID;
  cardId: ID;
  programId: ID;
  name: string;
  /** "cycle": por completar la tarjeta; "birthday": regalo de cumpleaños. */
  kind?: "cycle" | "birthday";
  status: RewardStatus;
  earnedAt: ISODate;
  expiresAt?: ISODate;
}

export interface Redemption {
  id: ID;
  businessId: ID;
  rewardId: ID; // UNIQUE → imposible canjear dos veces
  cardId: ID;
  staffId: ID;
  createdAt: ISODate;
}

export interface AuditLog {
  id: ID;
  businessId: ID | null; // null = acción de plataforma
  actorId: ID | null;
  action: string; // p.ej. "visit.created", "reward.redeemed"
  entity: string;
  entityId: ID;
  metadata?: Record<string, unknown>;
  createdAt: ISODate;
}

/** Módulo futuro, sin implementar. */
export interface Campaign {
  id: ID;
  businessId: ID;
  name: string;
  status: "draft";
}
