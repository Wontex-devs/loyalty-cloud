"use client";

/**
 * Capa de datos que consumen las pantallas (`useData`, `useBusiness`). `LiveProvider`
 * (live-provider.tsx) la llena con datos del servidor bajo RLS y escribe con Server Actions.
 */
import { createContext, useContext, useMemo } from "react";
import type { LedgerState } from "@/lib/domain/loyalty-engine";
import type { BusinessSettingsInput } from "@/lib/domain/schemas";
import { isRewardUsable, type BusinessStats } from "@/lib/domain/stats";
import type {
  Business,
  BusinessBranding,
  BusinessMembership,
  BusinessRole,
  BusinessStatus,
  Customer,
  CustomerContact,
  Location,
  LoyaltyProgram,
  Plan,
  Profile,
  Promotion,
  WalletNotice,
  WalletSettings,
} from "@/lib/domain/types";

export interface DataState extends LedgerState {
  businesses: Business[];
  plans: Plan[];
  /** Agregados por comercio (visibles para el superadmin sin datos personales). */
  businessStats: Record<string, { customers: number; visits30d: number; rewards30d: number }>;
  programs: LoyaltyProgram[];
  customers: Customer[];
  profiles: Profile[];
  memberships: BusinessMembership[];
  promotions: Promotion[];
  contacts: CustomerContact[];
  locations: Location[];
  /** Avisos enviados a las billeteras. */
  walletNotices: WalletNotice[];
  /** Usuario con sesión iniciada. */
  actingProfileId: string;
}


export type JoinResult = { ok: true; token: string; existing: boolean } | { ok: false; message: string };
/** Resultado común de operaciones (RPC en Postgres). */
export type OpResult =
  | { ok: true; data?: { reward?: unknown; bonusStamps?: number; birthdayReward?: string | null } }
  | { ok: false; message: string };
export type WalletCampaignResult =
  | { ok: true; queued: number; skipped: number; sent: number; notSaved: number; failed: number }
  | { ok: false; message: string };
export type PromotionInput = Pick<Promotion, "name" | "bonusStamps" | "startsOn" | "endsOn" | "weekdays" | "active">;

export interface DataApi {
  state: DataState;
  registerVisit: (cardId: string, idempotencyKey: string, locationId?: string) => Promise<OpResult>;
  reverseVisit: (visitId: string, reason: string) => Promise<OpResult>;
  redeemReward: (rewardId: string) => Promise<OpResult>;
  setCardBlocked: (cardId: string, blocked: boolean) => Promise<OpResult>;
  /** Supresión: borra los datos personales de la clienta y bloquea su tarjeta (solo propietario). */
  anonymizeCustomer: (customerId: string) => Promise<OpResult>;
  revokeMarketingConsent: (customerId: string) => Promise<OpResult>;
  /** Baja de mensajes desde la tarjeta pública (por token). */
  unsubscribeMarketing: (token: string) => Promise<boolean>;
  updateBusinessSettings: (businessId: string, input: BusinessSettingsInput) => Promise<OpResult>;
  savePromotion: (businessId: string, input: PromotionInput, id?: string) => Promise<OpResult>;
  logContact: (customerId: string, segment: string) => Promise<OpResult>;
  updateWalletSettings: (businessId: string, settings: WalletSettings) => Promise<OpResult>;
  /** Aviso a la billetera para todo un grupo (solo quienes aceptaron mensajes; máx. una campaña por semana). */
  sendWalletCampaign: (businessId: string, customerIds: string[], title: string, body: string) => Promise<WalletCampaignResult>;
  saveLocation: (businessId: string, input: { name: string; address?: string; active: boolean }, id?: string) => Promise<OpResult>;
  setBusinessPlan: (businessId: string, planId: string) => Promise<OpResult>;
  getStats: (businessId: string, days: number) => Promise<{ ok: true; stats: BusinessStats } | { ok: false; message: string }>;
  exportCustomers: (businessId: string) => Promise<{ ok: true; csv: string } | { ok: false; message: string }>;
  updateProgram: (programId: string, patch: Partial<LoyaltyProgram>) => void;
  updateBranding: (businessId: string, patch: Partial<BusinessBranding>) => void;
  /** Sube (o quita, con null) el logotipo del comercio. */
  setLogo: (businessId: string, file: File | null) => Promise<OpResult>;
  setCover: (businessId: string, file: File | null) => Promise<OpResult>;
  setBusinessStatus: (businessId: string, status: BusinessStatus) => void;
  inviteStaff: (businessId: string, input: { fullName: string; email: string; role: BusinessRole; canRedeem: boolean }) => void;
  toggleMembership: (membershipId: string, patch: Partial<BusinessMembership>) => void;
}

export const DataContext = createContext<DataApi | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <LiveProvider>");
  return ctx;
}

/** Selectores de tenant: todo acceso a datos operativos pasa por el businessId. */
export function useBusiness(slug: string) {
  const { state } = useData();
  return useMemo(() => {
    const business = state.businesses.find((b) => b.slug === slug);
    if (!business) return null;
    const id = business.id;
    const membership = state.memberships.find(
      (m) => m.businessId === id && m.profileId === state.actingProfileId,
    );
    return {
      business,
      membership,
      actingProfile: state.profiles.find((p) => p.id === state.actingProfileId),
      program: state.programs.find((p) => p.businessId === id),
      customers: state.customers.filter((c) => c.businessId === id),
      cards: state.cards.filter((c) => c.businessId === id),
      visits: state.visits.filter((v) => v.businessId === id),
      // Una recompensa disponible con fecha pasada se muestra como vencida (igual que en BD).
      rewards: state.rewards
        .filter((r) => r.businessId === id)
        .map((r) => (r.status === "available" && !isRewardUsable(r) ? { ...r, status: "expired" as const } : r)),
      redemptions: state.redemptions.filter((r) => r.businessId === id),
      auditLogs: state.auditLogs.filter((a) => a.businessId === id),
      promotions: (state.promotions ?? []).filter((p) => p.businessId === id),
      contacts: (state.contacts ?? []).filter((c) => c.businessId === id),
      walletNotices: (state.walletNotices ?? []).filter((n) => n.businessId === id),
      locations: (state.locations ?? []).filter((l) => l.businessId === id),
      plan: state.plans.find((p) => p.id === business.planId),
      memberships: state.memberships.filter((m) => m.businessId === id),
      profiles: state.profiles,
    };
  }, [state, slug]);
}

export type BusinessScope = NonNullable<ReturnType<typeof useBusiness>>;
