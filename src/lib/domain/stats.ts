/**
 * Estadísticas del comercio. En modo live las calcula Postgres (business_stats);
 * en demo se calculan aquí con la misma definición, para que el panel sea igual.
 */
import type { Customer, Location, LoyaltyCard, Profile, Redemption, Reward, Visit } from "./types";

export interface BusinessStats {
  days: number;
  /** Visitas netas del periodo: las revertidas no cuentan. */
  visits: number;
  visitsPrev: number;
  reversals: number;
  newCustomers: number;
  totalCustomers: number;
  /** Clientes con al menos una visita en el periodo. */
  activeCustomers: number;
  /** Clientes con dos o más visitas en el periodo. */
  returningCustomers: number;
  /** Recompensas emitidas en el periodo (sin las anuladas). */
  rewardsEarned: number;
  redemptions: number;
  rewardsAvailable: number;
  marketingConsent: number;
  daily: { date: string; value: number }[];
  /** Lunes a domingo. */
  weekday: number[];
  /** 0 a 23 h. */
  hourly: number[];
  byStaff: { name: string; visits: number; redemptions: number }[];
  byLocation: { name: string; visits: number }[];
  /** Índice = sellos actuales. */
  stampDistribution: number[];
}

/** Recompensa disponible y no vencida. */
export const isRewardUsable = (r: Reward, now = Date.now()) =>
  r.status === "available" && (!r.expiresAt || new Date(r.expiresAt).getTime() > now);

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function computeStats(
  data: {
    visits: Visit[];
    customers: Customer[];
    cards: LoyaltyCard[];
    rewards: Reward[];
    redemptions: Redemption[];
    profiles: Profile[];
    locations?: Location[];
  },
  days: number,
  stampsRequired: number,
  now = new Date(),
): BusinessStats {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const prev = new Date(today);
  prev.setDate(prev.getDate() - (2 * days - 1));
  const after = (iso: string, d: Date) => new Date(iso).getTime() >= d.getTime();

  const reversed = new Set(data.visits.map((v) => v.reversesVisitId).filter(Boolean));
  const net = data.visits.filter((v) => v.kind === "visit" && !reversed.has(v.id) && after(v.createdAt, prev));
  const cur = net.filter((v) => after(v.createdAt, from));
  const red = data.redemptions.filter((r) => after(r.createdAt, from));

  const perCard = new Map<string, number>();
  for (const v of cur) perCard.set(v.cardId, (perCard.get(v.cardId) ?? 0) + 1);

  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return { date: dayKey(d), value: 0 };
  });
  const dailyIdx = new Map(daily.map((d, i) => [d.date, i]));
  const weekday = new Array(7).fill(0);
  const hourly = new Array(24).fill(0);
  for (const v of cur) {
    const d = new Date(v.createdAt);
    const i = dailyIdx.get(dayKey(d));
    if (i !== undefined) daily[i].value++;
    weekday[(d.getDay() + 6) % 7]++;
    hourly[d.getHours()]++;
  }

  const staff = new Map<string, { visits: number; redemptions: number }>();
  const bump = (id: string, k: "visits" | "redemptions") => {
    const s = staff.get(id) ?? { visits: 0, redemptions: 0 };
    s[k]++;
    staff.set(id, s);
  };
  cur.forEach((v) => bump(v.staffId, "visits"));
  red.forEach((r) => bump(r.staffId, "redemptions"));

  const perLocation = new Map<string, number>();
  for (const v of cur) perLocation.set(v.locationId ?? "", (perLocation.get(v.locationId ?? "") ?? 0) + 1);

  const stampDistribution = new Array(Math.max(stampsRequired, 1)).fill(0);
  for (const c of data.cards) if (c.status !== "blocked") stampDistribution[Math.min(c.currentStamps, stampDistribution.length - 1)]++;

  return {
    days,
    visits: cur.length,
    visitsPrev: net.length - cur.length,
    reversals: data.visits.filter((v) => v.kind === "reversal" && after(v.createdAt, from)).length,
    newCustomers: data.customers.filter((c) => after(c.createdAt, from)).length,
    totalCustomers: data.customers.length,
    activeCustomers: perCard.size,
    returningCustomers: [...perCard.values()].filter((n) => n >= 2).length,
    rewardsEarned: data.rewards.filter((r) => r.status !== "void" && after(r.earnedAt, from)).length,
    redemptions: red.length,
    rewardsAvailable: data.rewards.filter((r) => isRewardUsable(r, now.getTime())).length,
    marketingConsent: data.customers.filter((c) => c.marketingConsent).length,
    daily,
    weekday,
    hourly,
    byStaff: [...staff.entries()]
      .map(([id, s]) => ({ name: data.profiles.find((p) => p.id === id)?.fullName ?? "Usuario eliminado", ...s }))
      .sort((a, b) => b.visits - a.visits || b.redemptions - a.redemptions),
    byLocation: [...perLocation.entries()]
      .map(([id, visits]) => ({ name: data.locations?.find((l) => l.id === id)?.name ?? "Sin sede", visits }))
      .sort((a, b) => b.visits - a.visits),
    stampDistribution,
  };
}

/** Fila jsonb de business_stats → BusinessStats. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function statsFromRow(r: any): BusinessStats {
  const n = (x: unknown) => Number(x ?? 0);
  return {
    days: n(r.days),
    visits: n(r.visits),
    visitsPrev: n(r.visits_prev),
    reversals: n(r.reversals),
    newCustomers: n(r.new_customers),
    totalCustomers: n(r.total_customers),
    activeCustomers: n(r.active_customers),
    returningCustomers: n(r.returning_customers),
    rewardsEarned: n(r.rewards_earned),
    redemptions: n(r.redemptions),
    rewardsAvailable: n(r.rewards_available),
    marketingConsent: n(r.marketing_consent),
    daily: (r.daily ?? []).map((d: { date: string; value: unknown }) => ({ date: String(d.date), value: n(d.value) })),
    weekday: (r.weekday ?? []).map(n),
    hourly: (r.hourly ?? []).map(n),
    byStaff: (r.by_staff ?? []).map((s: { name: string; visits: unknown; redemptions: unknown }) => ({
      name: s.name,
      visits: n(s.visits),
      redemptions: n(s.redemptions),
    })),
    byLocation: (r.by_location ?? []).map((l: { name: string; visits: unknown }) => ({ name: l.name, visits: n(l.visits) })),
    stampDistribution: (r.stamp_distribution ?? []).map(n),
  };
}
