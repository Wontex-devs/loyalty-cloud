"use client";

/**
 * Capa de datos que consumen las pantallas (`useDemo`, `useBusiness`).
 *
 * - Modo demo (sin Supabase configurado): store en el navegador con localStorage.
 * - Modo live (Etapa 2+): `LiveProvider` (src/lib/data/live-provider.tsx) expone la
 *   misma interfaz con datos cargados en el servidor bajo RLS y Server Actions.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as seed from "./data";
import {
  generatePublicToken,
  newId,
  redeemReward as engineRedeem,
  registerVisit as engineVisit,
  reverseVisit as engineReverse,
  type EngineResult,
  type LedgerState,
} from "@/lib/domain/loyalty-engine";
import { businessSettingsSchema, normalizePhone, type BusinessSettingsInput, type JoinInput } from "@/lib/domain/schemas";
import { computeStats, isRewardUsable, type BusinessStats } from "@/lib/domain/stats";
import { activePromotion, localDay } from "@/lib/domain/promotions";
import { customersCsv } from "@/lib/domain/csv";
import { blobToDataUrl, prepareLogo } from "@/lib/brand-image";
import type {
  Business,
  BusinessBranding,
  BusinessMembership,
  BusinessRole,
  BusinessStatus,
  Customer,
  CustomerContact,
  Location,
  LoyaltyCard,
  LoyaltyProgram,
  Plan,
  Profile,
  Promotion,
} from "@/lib/domain/types";

const STORAGE_KEY = "loyalty-demo-v1";

export interface DemoState extends LedgerState {
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
  /** Perfil con el que se navega el panel del comercio (simula la sesión). */
  actingProfileId: string;
}

function initialState(): DemoState {
  return structuredClone({
    businesses: seed.businesses,
    plans: seed.plans,
    businessStats: seed.businessStats,
    programs: seed.programs,
    customers: seed.customers,
    profiles: seed.profiles,
    memberships: seed.memberships,
    cards: seed.cards,
    visits: seed.visits,
    rewards: seed.rewards,
    redemptions: seed.redemptions,
    auditLogs: seed.auditLogs,
    promotions: [] as Promotion[],
    contacts: [] as CustomerContact[],
    locations: [] as Location[],
    actingProfileId: "usr_owner",
  });
}

export type JoinResult = { ok: true; token: string; existing: boolean } | { ok: false; message: string };
/** Resultado común de operaciones (demo: motor local; live: RPC en Postgres). */
export type OpResult =
  | { ok: true; data?: { reward?: unknown; bonusStamps?: number; birthdayReward?: string | null } }
  | { ok: false; message: string };
export type PromotionInput = Pick<Promotion, "name" | "bonusStamps" | "startsOn" | "endsOn" | "weekdays" | "active">;

export interface DemoApi {
  mode: "demo" | "live";
  state: DemoState;
  hydrated: boolean;
  setActingProfile: (id: string) => void;
  joinProgram: (businessId: string, input: JoinInput) => Promise<JoinResult>;
  registerVisit: (cardId: string, idempotencyKey: string, locationId?: string) => Promise<OpResult>;
  reverseVisit: (visitId: string, reason: string) => Promise<OpResult>;
  redeemReward: (rewardId: string) => Promise<OpResult>;
  setCardBlocked: (cardId: string, blocked: boolean) => Promise<OpResult>;
  updateBusinessSettings: (businessId: string, input: BusinessSettingsInput) => Promise<OpResult>;
  savePromotion: (businessId: string, input: PromotionInput, id?: string) => Promise<OpResult>;
  logContact: (customerId: string, segment: string) => Promise<OpResult>;
  saveLocation: (businessId: string, input: { name: string; address?: string; active: boolean }, id?: string) => Promise<OpResult>;
  setBusinessPlan: (businessId: string, planId: string) => Promise<OpResult>;
  getStats: (businessId: string, days: number) => Promise<{ ok: true; stats: BusinessStats } | { ok: false; message: string }>;
  exportCustomers: (businessId: string) => Promise<{ ok: true; csv: string } | { ok: false; message: string }>;
  updateProgram: (programId: string, patch: Partial<LoyaltyProgram>) => void;
  updateBranding: (businessId: string, patch: Partial<BusinessBranding>) => void;
  /** Sube (o quita, con null) el logotipo del comercio. */
  setLogo: (businessId: string, file: File | null) => Promise<OpResult>;
  setBusinessStatus: (businessId: string, status: BusinessStatus) => void;
  inviteStaff: (businessId: string, input: { fullName: string; email: string; role: BusinessRole; canRedeem: boolean }) => void;
  toggleMembership: (membershipId: string, patch: Partial<BusinessMembership>) => void;
  reset: () => void;
}

export const DataContext = createContext<DemoApi | null>(null);
const Ctx = DataContext;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  // Referencia síncrona: dos clics rápidos ven el estado ya actualizado (idempotencia real).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<DemoState>;
        // Datos guardados por versiones anteriores del prototipo: se completan los campos nuevos.
        if (saved.businesses) saved.businesses = saved.businesses.map((b) => ({ ...b, legal: b.legal ?? {} }));
        // Los planes son datos de referencia: siempre los del código, no los guardados.
        delete saved.plans;
        setState({ ...initialState(), ...saved });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  // Sincroniza entre pestañas: la tarjeta del cliente se actualiza al registrar una visita.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setState(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const acting = useCallback(
    (s: DemoState, businessId: string) =>
      s.memberships.find((m) => m.profileId === s.actingProfileId && m.businessId === businessId),
    [],
  );

  const runEngine = useCallback(
    (fn: (s: DemoState) => EngineResult<unknown>): OpResult => {
      const result = fn(stateRef.current);
      if (!result.ok) return { ok: false, message: result.message };
      const next = { ...stateRef.current, ...result.state };
      stateRef.current = next;
      setState(next);
      return { ok: true, data: result.data as { reward?: unknown } };
    },
    [],
  );

  const api = useMemo<DemoApi>(
    () => ({
      mode: "demo",
      state,
      hydrated,
      setActingProfile: (id) => setState((s) => ({ ...s, actingProfileId: id })),

      joinProgram: async (businessId, input) => {
        const program = state.programs.find((p) => p.businessId === businessId && p.active);
        if (!program) return { ok: false, message: "Este comercio no tiene un programa activo." };
        const phone = normalizePhone(input.phone);
        const plan = state.plans.find((p) => p.id === state.businesses.find((b) => b.id === businessId)?.planId);
        const isNew = !state.customers.some((c) => c.businessId === businessId && normalizePhone(c.phone) === phone);
        if (isNew && plan?.maxCustomers && state.customers.filter((c) => c.businessId === businessId).length >= plan.maxCustomers) {
          return { ok: false, message: "Este programa alcanzó su cupo de clientes. Pide ayuda en el establecimiento." };
        }
        // Protección contra duplicados: UNIQUE(business_id, phone) en BD.
        const existing = state.customers.find(
          (c) => c.businessId === businessId && normalizePhone(c.phone) === phone,
        );
        if (existing) {
          // Igual que en la BD: recuperar la tarjeta exige el mismo nombre.
          const norm = (x: string) => x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
          if (norm(existing.fullName) !== norm(input.fullName)) {
            return { ok: false, message: "Este celular ya tiene una tarjeta con otro nombre. Escribe tu nombre tal como lo registraste o pide tu enlace en el establecimiento." };
          }
          const card = state.cards.find(
            (c) => c.customerId === existing.id && c.programId === program.id,
          );
          if (card) return { ok: true, token: card.publicToken, existing: true };
        }
        const now = new Date().toISOString();
        const customer: Customer = {
          id: newId("cus_"),
          businessId,
          fullName: input.fullName.trim(),
          phone,
          email: input.email || undefined,
          birthMonth: input.birthMonth,
          birthDay: input.birthDay,
          termsAcceptedAt: now,
          marketingConsent: input.marketingConsent,
          marketingConsentAt: input.marketingConsent ? now : undefined,
          createdAt: now,
        };
        const card: LoyaltyCard = {
          id: newId("crd_"),
          businessId,
          programId: program.id,
          customerId: customer.id,
          publicToken: generatePublicToken(),
          status: "active",
          currentStamps: program.welcomeStamps ?? 0,
          totalVisits: 0,
          createdAt: now,
        };
        setState((s) => ({
          ...s,
          customers: [customer, ...s.customers],
          cards: [card, ...s.cards],
          auditLogs: [
            { id: newId("aud_"), businessId, actorId: null, action: "customer.registered", entity: "customer", entityId: customer.id, createdAt: now },
            ...s.auditLogs,
          ],
        }));
        return { ok: true, token: card.publicToken, existing: false };
      },

      registerVisit: async (cardId, idempotencyKey, locationId) => {
        let bonus = 0;
        let bday: string | null = null;
        const res = runEngine((s) => {
          const card = s.cards.find((c) => c.id === cardId);
          const program = s.programs.find((p) => p.id === card?.programId);
          if (!card || !program) return { ok: false, error: "CARD_NOT_FOUND", message: "No se encontró la tarjeta." };
          const promo = activePromotion((s.promotions ?? []).filter((p) => p.businessId === card.businessId));
          const customer = s.customers.find((c) => c.id === card.customerId);
          const today = localDay();
          bonus = promo?.bonusStamps ?? 0;
          const birthday = program.birthdayReward && customer?.birthMonth === today.month ? { name: program.birthdayReward, year: today.year } : null;
          const r = engineVisit(s, program, { cardId, staffId: s.actingProfileId, idempotencyKey, bonusStamps: bonus, promotionId: promo?.id, birthday });
          if (r.ok) bday = r.data.birthdayReward?.name ?? null;
          if (r.ok && locationId) r.state.visits = r.state.visits.map((v) => (v.id === r.data.visit.id ? { ...v, locationId } : v));
          return r;
        });
        return res.ok ? { ok: true, data: { ...res.data, bonusStamps: bonus, birthdayReward: bday } } : res;
      },

      reverseVisit: async (visitId, reason) =>
        runEngine((s) => engineReverse(s, { visitId, staffId: s.actingProfileId, reason })),

      redeemReward: async (rewardId) =>
        runEngine((s) => {
          const reward = s.rewards.find((r) => r.id === rewardId);
          const m = reward ? acting(s, reward.businessId) : undefined;
          const canRedeem = !!m && (m.role !== "staff" || m.canRedeem);
          return engineRedeem(s, { rewardId, staffId: s.actingProfileId, canRedeem });
        }),

      setCardBlocked: async (cardId, blocked) => {
        const s = stateRef.current;
        const card = s.cards.find((c) => c.id === cardId);
        const m = card ? acting(s, card.businessId) : undefined;
        if (!card || !m || m.role === "staff") return { ok: false, message: "No tienes permiso para realizar esta acción." };
        const hasReward = s.rewards.some((r) => r.cardId === cardId && r.status === "available");
        const status = blocked ? "blocked" : hasReward ? "reward_available" : "active";
        const now = new Date().toISOString();
        const next: DemoState = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, status } : c)),
          auditLogs: [
            { id: newId("aud_"), businessId: card.businessId, actorId: s.actingProfileId, action: blocked ? "card.blocked" : "card.unblocked", entity: "loyalty_card", entityId: cardId, createdAt: now },
            ...s.auditLogs,
          ],
        };
        stateRef.current = next;
        setState(next);
        return { ok: true };
      },

      updateBusinessSettings: async (businessId, input) => {
        const parsed = businessSettingsSchema.safeParse(input);
        if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
        const { legalName, taxId, contactEmail, contactPhone, address, ...rest } = parsed.data;
        const legal = { legalName: legalName || undefined, taxId: taxId || undefined, contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined, address: address || undefined };
        const next = { ...stateRef.current, businesses: stateRef.current.businesses.map((b) => (b.id === businessId ? { ...b, ...rest, legal } : b)) };
        stateRef.current = next;
        setState(next);
        return { ok: true };
      },

      savePromotion: async (businessId, input, id) => {
        const s = stateRef.current;
        if (acting(s, businessId)?.role === "staff") return { ok: false, message: "No tienes permiso para realizar esta acción." };
        const list = s.promotions ?? [];
        const promotions = id
          ? list.map((p) => (p.id === id ? { ...p, ...input } : p))
          : [{ id: newId("prm_"), businessId, createdAt: new Date().toISOString(), ...input }, ...list];
        const next = { ...s, promotions };
        stateRef.current = next;
        setState(next);
        return { ok: true };
      },

      logContact: async (customerId, segment) => {
        const s = stateRef.current;
        const customer = s.customers.find((c) => c.id === customerId);
        if (!customer?.marketingConsent) return { ok: false, message: "Esta clienta no aceptó recibir mensajes." };
        const contact: CustomerContact = { id: newId("con_"), businessId: customer.businessId, customerId, segment, staffId: s.actingProfileId, createdAt: new Date().toISOString() };
        const next = { ...s, contacts: [contact, ...(s.contacts ?? [])] };
        stateRef.current = next;
        setState(next);
        return { ok: true };
      },

      saveLocation: async (businessId, input, id) => {
        const s = stateRef.current;
        if (acting(s, businessId)?.role === "staff") return { ok: false, message: "No tienes permiso para realizar esta acción." };
        const list = s.locations ?? [];
        const plan = s.plans.find((p) => p.id === s.businesses.find((b) => b.id === businessId)?.planId);
        const activeOthers = list.filter((l) => l.businessId === businessId && l.active && l.id !== id).length;
        if (input.active && plan?.maxLocations && activeOthers >= plan.maxLocations) {
          return { ok: false, message: `Tu plan permite ${plan.maxLocations} ${plan.maxLocations === 1 ? "sede activa" : "sedes activas"}.` };
        }
        const locations = id
          ? list.map((l) => (l.id === id ? { ...l, ...input } : l))
          : [...list, { id: newId("loc_"), businessId, createdAt: new Date().toISOString(), ...input }];
        const next = { ...s, locations };
        stateRef.current = next;
        setState(next);
        return { ok: true };
      },

      setBusinessPlan: async (businessId, planId) => {
        const next = { ...stateRef.current, businesses: stateRef.current.businesses.map((b) => (b.id === businessId ? { ...b, planId } : b)) };
        stateRef.current = next;
        setState(next);
        return { ok: true };
      },

      getStats: async (businessId, days) => {
        const s = stateRef.current;
        const of = <T extends { businessId: string }>(xs: T[]) => xs.filter((x) => x.businessId === businessId);
        const program = s.programs.find((p) => p.businessId === businessId && p.active);
        const stats = computeStats(
          {
            visits: of(s.visits),
            customers: of(s.customers),
            cards: of(s.cards),
            rewards: of(s.rewards),
            redemptions: of(s.redemptions),
            profiles: s.profiles,
            locations: of(s.locations ?? []),
          },
          days,
          program?.stampsRequired ?? 1,
        );
        return { ok: true, stats };
      },

      exportCustomers: async (businessId) => {
        const s = stateRef.current;
        if (acting(s, businessId)?.role !== "owner") return { ok: false, message: "Solo el propietario puede exportar clientes." };
        return { ok: true, csv: customersCsv(s.customers.filter((c) => c.businessId === businessId), s.cards.filter((c) => c.businessId === businessId)) };
      },

      updateProgram: (programId, patch) =>
        setState((s) => ({
          ...s,
          programs: s.programs.map((p) => (p.id === programId ? { ...p, ...patch } : p)),
        })),

      updateBranding: (businessId, patch) =>
        setState((s) => ({
          ...s,
          businesses: s.businesses.map((b) =>
            b.id === businessId ? { ...b, branding: { ...b.branding, ...patch } } : b,
          ),
        })),

      // En demo el logo se guarda como data URL pequeño en el navegador.
      setLogo: async (businessId, file) => {
        try {
          const logoUrl = file ? await blobToDataUrl(await prepareLogo(file, 256)) : "";
          setState((s) => ({
            ...s,
            businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, branding: { ...b.branding, logoUrl } } : b)),
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : "No se pudo cargar la imagen." };
        }
      },

      setBusinessStatus: (businessId, status) =>
        setState((s) => ({
          ...s,
          businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, status } : b)),
        })),

      inviteStaff: (businessId, input) =>
        setState((s) => {
          const now = new Date().toISOString();
          const profile: Profile = { id: newId("usr_"), fullName: input.fullName, email: input.email, platformRole: "user", createdAt: now };
          return {
            ...s,
            profiles: [...s.profiles, profile],
            memberships: [
              ...s.memberships,
              { id: newId("mem_"), businessId, profileId: profile.id, role: input.role, canRedeem: input.canRedeem, active: true, createdAt: now },
            ],
          };
        }),

      toggleMembership: (membershipId, patch) =>
        setState((s) => ({
          ...s,
          memberships: s.memberships.map((m) => (m.id === membershipId ? { ...m, ...patch } : m)),
        })),

      reset: () => setState(initialState()),
    }),
    [state, hydrated, runEngine, acting],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo debe usarse dentro de <DemoProvider>");
  return ctx;
}

/** Selectores de tenant: todo acceso a datos operativos pasa por el businessId. */
export function useBusiness(slug: string) {
  const { state } = useDemo();
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
      locations: (state.locations ?? []).filter((l) => l.businessId === id),
      plan: state.plans.find((p) => p.id === business.planId),
      memberships: state.memberships.filter((m) => m.businessId === id),
      profiles: state.profiles,
    };
  }, [state, slug]);
}

export type BusinessScope = NonNullable<ReturnType<typeof useBusiness>>;
