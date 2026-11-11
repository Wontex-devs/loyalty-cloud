/**
 * Motor de fidelización: funciones puras sin dependencias de UI ni de base de datos.
 *
 * Las reglas reales viven en Postgres (funciones transaccionales); este módulo las
 * replica con los mismos códigos de error para calcular el progreso y probarlas.
 * Canales futuros (Apple/Google Wallet) solo consumen los `events` que emite.
 */
import type {
  AuditLog,
  ID,
  LoyaltyCard,
  LoyaltyProgram,
  Redemption,
  Reward,
  Visit,
} from "./types";

export interface LedgerState {
  cards: LoyaltyCard[];
  visits: Visit[];
  rewards: Reward[];
  redemptions: Redemption[];
  auditLogs: AuditLog[];
}

export type EngineEvent =
  | { type: "card.updated"; cardId: ID }
  | { type: "reward.earned"; cardId: ID; rewardId: ID }
  | { type: "reward.redeemed"; cardId: ID; rewardId: ID };

export type EngineError =
  | "CARD_NOT_FOUND"
  | "CARD_BLOCKED"
  | "PROGRAM_INACTIVE"
  | "DUPLICATE_REQUEST"
  | "TOO_SOON"
  | "VISIT_NOT_FOUND"
  | "ALREADY_REVERSED"
  | "REWARD_NOT_FOUND"
  | "REWARD_NOT_AVAILABLE"
  | "ALREADY_REDEEMED"
  | "REWARD_EXPIRED"
  | "FORBIDDEN";

export type EngineResult<T> =
  | { ok: true; state: LedgerState; data: T; events: EngineEvent[] }
  | { ok: false; error: EngineError; message: string };

export const ERROR_MESSAGES: Record<EngineError, string> = {
  CARD_NOT_FOUND: "No se encontró la tarjeta.",
  CARD_BLOCKED: "La tarjeta está bloqueada.",
  PROGRAM_INACTIVE: "El programa de fidelización no está activo.",
  DUPLICATE_REQUEST: "Esta operación ya fue registrada.",
  TOO_SOON: "Ya se registró una visita hace muy poco para esta tarjeta.",
  VISIT_NOT_FOUND: "No se encontró la visita.",
  ALREADY_REVERSED: "Esta visita ya fue revertida.",
  REWARD_NOT_FOUND: "No se encontró la recompensa.",
  REWARD_NOT_AVAILABLE: "La recompensa no está disponible para canje.",
  ALREADY_REDEEMED: "Esta recompensa ya fue canjeada.",
  REWARD_EXPIRED: "La recompensa ya venció.",
  FORBIDDEN: "No tienes permiso para realizar esta acción.",
};

const fail = <T>(error: EngineError): EngineResult<T> => ({
  ok: false,
  error,
  message: ERROR_MESSAGES[error],
});

export function newId(prefix = ""): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token público de tarjeta: 128 bits aleatorios en base64url (22 caracteres). */
export function generatePublicToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface CardProgress {
  stamps: number;
  required: number;
  remaining: number;
  percent: number;
  rewardsAvailable: number;
}

export function getProgress(
  card: LoyaltyCard,
  program: LoyaltyProgram,
  rewards: Reward[],
): CardProgress {
  const required = program.stampsRequired;
  const stamps = Math.min(card.currentStamps, required);
  const rewardsAvailable = rewards.filter(
    (r) => r.cardId === card.id && r.status === "available",
  ).length;
  return {
    stamps,
    required,
    remaining: Math.max(required - stamps, 0),
    percent: Math.round((stamps / required) * 100),
    rewardsAvailable,
  };
}

function audit(
  state: LedgerState,
  entry: Omit<AuditLog, "id" | "createdAt">,
  now: string,
): AuditLog[] {
  return [{ ...entry, id: newId("aud_"), createdAt: now }, ...state.auditLogs];
}

interface VisitInput {
  cardId: ID;
  staffId: ID;
  idempotencyKey: string;
  now?: Date;
  /** Sellos extra por una promoción vigente (doble sello = 1). */
  bonusStamps?: number;
  promotionId?: ID;
  /** Si es la primera visita del mes de cumpleaños: nombre del regalo y año. */
  birthday?: { name: string; year: number } | null;
}

/**
 * Registra una visita. Si se completa la meta, emite una recompensa y reinicia el ciclo.
 * Reglas: tarjeta activa, programa activo, idempotencia y tiempo mínimo entre visitas.
 */
export function registerVisit(
  state: LedgerState,
  program: LoyaltyProgram,
  input: VisitInput,
): EngineResult<{ visit: Visit; reward?: Reward; birthdayReward?: Reward; card: LoyaltyCard }> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const card = state.cards.find((c) => c.id === input.cardId);
  if (!card) return fail("CARD_NOT_FOUND");
  if (card.status === "blocked") return fail("CARD_BLOCKED");
  if (!program.active) return fail("PROGRAM_INACTIVE");
  if (state.visits.some((v) => v.idempotencyKey === input.idempotencyKey))
    return fail("DUPLICATE_REQUEST");

  if (card.lastVisitAt && program.minMinutesBetweenVisits > 0) {
    const diffMin = (now.getTime() - new Date(card.lastVisitAt).getTime()) / 60000;
    if (diffMin < program.minMinutesBetweenVisits) return fail("TOO_SOON");
  }

  const visit: Visit = {
    id: newId("vis_"),
    businessId: card.businessId,
    cardId: card.id,
    kind: "visit",
    delta: 1,
    staffId: input.staffId,
    idempotencyKey: input.idempotencyKey,
    bonusStamps: input.bonusStamps ?? 0,
    promotionId: input.promotionId,
    createdAt: nowIso,
  };

  let stamps = card.currentStamps + 1 + (input.bonusStamps ?? 0);
  let reward: Reward | undefined;
  const events: EngineEvent[] = [{ type: "card.updated", cardId: card.id }];

  if (stamps >= program.stampsRequired) {
    // Los sellos sobrantes de una promoción pasan al siguiente ciclo.
    stamps = Math.min(stamps - program.stampsRequired, program.stampsRequired - 1);
    reward = {
      id: newId("rwd_"),
      businessId: card.businessId,
      cardId: card.id,
      programId: program.id,
      name: program.rewardName,
      status: "available",
      earnedAt: nowIso,
      expiresAt: program.rewardExpiryDays
        ? new Date(now.getTime() + program.rewardExpiryDays * 86400000).toISOString()
        : undefined,
    };
    events.push({ type: "reward.earned", cardId: card.id, rewardId: reward.id });
  }

  // Regalo de cumpleaños: uno por año y tarjeta.
  let birthdayReward: Reward | undefined;
  const bday = input.birthday;
  if (bday && !state.rewards.some((r) => r.cardId === card.id && r.kind === "birthday" && new Date(r.earnedAt).getFullYear() === bday.year)) {
    birthdayReward = {
      id: newId("rwd_"),
      businessId: card.businessId,
      cardId: card.id,
      programId: program.id,
      name: bday.name,
      kind: "birthday",
      status: "available",
      earnedAt: nowIso,
      expiresAt: new Date(now.getTime() + 30 * 86400000).toISOString(),
    };
    events.push({ type: "reward.earned", cardId: card.id, rewardId: birthdayReward.id });
  }

  const updatedCard: LoyaltyCard = {
    ...card,
    currentStamps: stamps,
    totalVisits: card.totalVisits + 1,
    lastVisitAt: nowIso,
    status: reward || birthdayReward ? "reward_available" : card.status,
  };

  let auditLogs = audit(
    state,
    {
      businessId: card.businessId,
      actorId: input.staffId,
      action: "visit.created",
      entity: "visit",
      entityId: visit.id,
      metadata: { cardId: card.id },
    },
    nowIso,
  );
  if (reward) {
    auditLogs = audit(
      { ...state, auditLogs },
      {
        businessId: card.businessId,
        actorId: null,
        action: "reward.earned",
        entity: "reward",
        entityId: reward.id,
        metadata: { cardId: card.id },
      },
      nowIso,
    );
  }

  return {
    ok: true,
    data: { visit, reward, birthdayReward, card: updatedCard },
    events,
    state: {
      ...state,
      cards: state.cards.map((c) => (c.id === card.id ? updatedCard : c)),
      visits: [visit, ...state.visits],
      rewards: [...(reward ? [reward] : []), ...(birthdayReward ? [birthdayReward] : []), ...state.rewards],
      auditLogs,
    },
  };
}

/** Corrige una visita creando un movimiento de reversión auditado (nunca se borra). */
export function reverseVisit(
  state: LedgerState,
  input: { visitId: ID; staffId: ID; reason: string; now?: Date },
): EngineResult<{ reversal: Visit }> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const original = state.visits.find((v) => v.id === input.visitId && v.kind === "visit");
  if (!original) return fail("VISIT_NOT_FOUND");
  if (state.visits.some((v) => v.reversesVisitId === original.id))
    return fail("ALREADY_REVERSED");
  const card = state.cards.find((c) => c.id === original.cardId);
  if (!card) return fail("CARD_NOT_FOUND");

  const reversal: Visit = {
    id: newId("vis_"),
    businessId: original.businessId,
    cardId: original.cardId,
    kind: "reversal",
    delta: -1,
    reversesVisitId: original.id,
    reason: input.reason,
    staffId: input.staffId,
    idempotencyKey: `reverse:${original.id}`,
    createdAt: nowIso,
  };
  const updatedCard: LoyaltyCard = {
    ...card,
    currentStamps: Math.max(card.currentStamps - 1 - (original.bonusStamps ?? 0), 0),
    totalVisits: Math.max(card.totalVisits - 1, 0),
  };

  return {
    ok: true,
    data: { reversal },
    events: [{ type: "card.updated", cardId: card.id }],
    state: {
      ...state,
      cards: state.cards.map((c) => (c.id === card.id ? updatedCard : c)),
      visits: [reversal, ...state.visits],
      auditLogs: audit(
        state,
        {
          businessId: card.businessId,
          actorId: input.staffId,
          action: "visit.reversed",
          entity: "visit",
          entityId: original.id,
          metadata: { reason: input.reason },
        },
        nowIso,
      ),
    },
  };
}

/** Canjea una recompensa. En BD: UNIQUE(redemptions.reward_id) + UPDATE condicional. */
export function redeemReward(
  state: LedgerState,
  input: { rewardId: ID; staffId: ID; canRedeem: boolean; now?: Date },
): EngineResult<{ redemption: Redemption }> {
  if (!input.canRedeem) return fail("FORBIDDEN");
  const nowIso = (input.now ?? new Date()).toISOString();
  const reward = state.rewards.find((r) => r.id === input.rewardId);
  if (!reward) return fail("REWARD_NOT_FOUND");
  if (state.redemptions.some((r) => r.rewardId === reward.id)) return fail("ALREADY_REDEEMED");
  if (reward.status !== "available") return fail("REWARD_NOT_AVAILABLE");
  if (reward.expiresAt && new Date(reward.expiresAt).getTime() <= new Date(nowIso).getTime()) return fail("REWARD_EXPIRED");
  if (state.cards.some((c) => c.id === reward.cardId && c.status === "blocked")) return fail("CARD_BLOCKED");

  const redemption: Redemption = {
    id: newId("red_"),
    businessId: reward.businessId,
    rewardId: reward.id,
    cardId: reward.cardId,
    staffId: input.staffId,
    createdAt: nowIso,
  };
  const rewards = state.rewards.map((r) =>
    r.id === reward.id ? { ...r, status: "redeemed" as const } : r,
  );
  const stillAvailable = rewards.some(
    (r) => r.cardId === reward.cardId && r.status === "available",
  );
  const cards = state.cards.map((c) =>
    c.id === reward.cardId && c.status === "reward_available" && !stillAvailable
      ? { ...c, status: "active" as const }
      : c,
  );

  return {
    ok: true,
    data: { redemption },
    events: [
      { type: "reward.redeemed", cardId: reward.cardId, rewardId: reward.id },
      { type: "card.updated", cardId: reward.cardId },
    ],
    state: {
      ...state,
      cards,
      rewards,
      redemptions: [redemption, ...state.redemptions],
      auditLogs: audit(
        state,
        {
          businessId: reward.businessId,
          actorId: input.staffId,
          action: "reward.redeemed",
          entity: "reward",
          entityId: reward.id,
        },
        nowIso,
      ),
    },
  };
}
