/**
 * Reporte mensual para el dueño: un resumen del mes que se lee en un minuto.
 * Se calcula con los datos que ya tiene el panel, por mes calendario en la zona horaria
 * del comercio, y se compara con el mes anterior.
 */
import type { Customer, LoyaltyCard, Redemption, Reward, Visit, WalletNotice } from "./types";

export interface ClienteDelMes {
  name: string;
  visits: number;
  stamps: number;
}

export interface ClienteEnfriado {
  name: string;
  stamps: number;
  lastVisitAt: string;
}

export interface MonthlyReport {
  /** "2026-11" */
  month: string;
  /** "noviembre de 2026" */
  label: string;
  /** El mes todavía no termina (cifras parciales). */
  partial: boolean;
  /** Visitas netas (sin las revertidas). */
  visits: number;
  prevVisits: number;
  /** Clientes con al menos una visita en el mes. */
  activeCustomers: number;
  prevActiveCustomers: number;
  newCustomers: number;
  prevNewCustomers: number;
  /** Clientes del mes que ya habían venido antes (no son nuevos ese mes). */
  returningCustomers: number;
  rewardsEarned: number;
  prevRewardsEarned: number;
  redemptions: number;
  prevRedemptions: number;
  /** Recordatorios («te extrañamos» y «te falta poco») que llegaron en el mes. */
  remindersSent: number;
  /** De esos, cuántos clientes volvieron después del aviso. */
  remindersReturned: number;
  /** Hasta 5, de más a menos visitas en el mes. */
  topCustomers: ClienteDelMes[];
  /** Vinieron el mes anterior y no en este (hasta 5, primero los más cerca del premio). */
  cooling: ClienteEnfriado[];
  coolingCount: number;
  /** Día de la semana con más visitas (0 = lunes), o null sin visitas. */
  bestWeekday: number | null;
}

export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const formatos = new Map<string, Intl.DateTimeFormat>();

/** Partes de una fecha en la zona horaria del comercio. */
function partes(iso: string | Date, timeZone: string) {
  let f = formatos.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
    formatos.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return { month: `${p.year}-${p.month}`, weekday: wd };
}

/** Mes ("2026-11") de una fecha, en la zona horaria del comercio. */
export const monthKey = (iso: string | Date, timeZone: string) => partes(iso, timeZone).month;

export function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} de ${y}`;
}

/** Meses con reporte: desde que se creó el comercio hasta el actual, el más reciente primero (máx. 24). */
export function reportMonths(createdAt: string, timeZone: string, now = new Date()) {
  const first = monthKey(createdAt, timeZone);
  const out: string[] = [];
  let m = monthKey(now, timeZone);
  while (out.length < 24) {
    out.push(m);
    if (m <= first) break;
    m = previousMonth(m);
  }
  return out;
}

const nameOf = (c?: Customer) => (!c || c.anonymizedAt ? "Cliente" : c.fullName.trim() || "Cliente");

export function monthlyReport(
  data: {
    customers: Customer[];
    cards: LoyaltyCard[];
    visits: Visit[];
    rewards: Reward[];
    redemptions: Redemption[];
    walletNotices: WalletNotice[];
  },
  month: string,
  timeZone: string,
  now = new Date(),
): MonthlyReport {
  const prev = previousMonth(month);
  const mk = (iso: string) => monthKey(iso, timeZone);

  const reversed = new Set(data.visits.map((v) => v.reversesVisitId).filter(Boolean));
  const net = data.visits.filter((v) => v.kind === "visit" && !reversed.has(v.id));
  const cur = net.filter((v) => mk(v.createdAt) === month);
  const ant = net.filter((v) => mk(v.createdAt) === prev);

  const cardById = new Map(data.cards.map((c) => [c.id, c]));
  const customerById = new Map(data.customers.map((c) => [c.id, c]));
  const customerOfCard = (cardId: string) => customerById.get(cardById.get(cardId)?.customerId ?? "");

  const perCard = new Map<string, number>();
  for (const v of cur) perCard.set(v.cardId, (perCard.get(v.cardId) ?? 0) + 1);
  const prevCards = new Set(ant.map((v) => v.cardId));

  // Quiénes ya habían venido antes de este mes.
  const visitoAntes = new Set(net.filter((v) => mk(v.createdAt) < month).map((v) => v.cardId));
  const returningCustomers = [...perCard.keys()].filter((id) => visitoAntes.has(id)).length;

  const weekday = new Array(7).fill(0);
  for (const v of cur) weekday[partes(v.createdAt, timeZone).weekday]++;
  const maxWd = Math.max(...weekday);

  const topCustomers = [...perCard.entries()]
    .sort((a, b) => b[1] - a[1] || (cardById.get(b[0])?.currentStamps ?? 0) - (cardById.get(a[0])?.currentStamps ?? 0))
    .slice(0, 5)
    .map(([cardId, visits]) => ({ name: nameOf(customerOfCard(cardId)), visits, stamps: cardById.get(cardId)?.currentStamps ?? 0 }));

  const enfriados = [...prevCards]
    .filter((id) => !perCard.has(id) && cardById.get(id)?.status !== "blocked" && !customerOfCard(id)?.anonymizedAt)
    .map((id) => {
      const card = cardById.get(id);
      return { name: nameOf(customerOfCard(id)), stamps: card?.currentStamps ?? 0, lastVisitAt: card?.lastVisitAt ?? "" };
    })
    .sort((a, b) => b.stamps - a.stamps || b.lastVisitAt.localeCompare(a.lastVisitAt));

  const recordatorios = data.walletNotices.filter(
    (n) => (n.kind === "winback" || n.kind === "almost") && n.status === "sent" && mk(n.createdAt) === month,
  );
  const remindersReturned = recordatorios.filter((n) => {
    const t = new Date(n.createdAt).getTime();
    return net.some((v) => v.cardId === n.cardId && new Date(v.createdAt).getTime() > t);
  }).length;

  const rewardsIn = (m: string) => data.rewards.filter((r) => r.status !== "void" && mk(r.earnedAt) === m).length;
  const redemptionsIn = (m: string) => data.redemptions.filter((r) => mk(r.createdAt) === m).length;
  const newIn = (m: string) => data.customers.filter((c) => mk(c.createdAt) === m).length;

  return {
    month,
    label: monthLabel(month),
    partial: month >= monthKey(now, timeZone),
    visits: cur.length,
    prevVisits: ant.length,
    activeCustomers: perCard.size,
    prevActiveCustomers: prevCards.size,
    newCustomers: newIn(month),
    prevNewCustomers: newIn(prev),
    returningCustomers,
    rewardsEarned: rewardsIn(month),
    prevRewardsEarned: rewardsIn(prev),
    redemptions: redemptionsIn(month),
    prevRedemptions: redemptionsIn(prev),
    remindersSent: recordatorios.length,
    remindersReturned,
    topCustomers,
    cooling: enfriados.slice(0, 5),
    coolingCount: enfriados.length,
    bestWeekday: maxWd > 0 ? weekday.indexOf(maxWd) : null,
  };
}

/** Cambio frente al mes anterior: «+25 %», «−10 %», «igual» o null si antes no hubo nada. */
export function change(cur: number, prev: number): string | null {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return "igual";
  return pct > 0 ? `+${pct} %` : `−${Math.abs(pct)} %`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Frases del resumen, en lenguaje sencillo. */
export function reportHighlights(r: MonthlyReport): string[] {
  const out: string[] = [];
  const periodo = r.partial ? `En lo que va de ${r.label.split(" de ")[0]}` : `En ${r.label.split(" de ")[0]}`;
  if (!r.visits && !r.newCustomers) {
    out.push(`${periodo} no se registraron visitas.`);
    return out;
  }
  out.push(
    `${periodo} te ${r.activeCustomers === 1 ? "visitó" : "visitaron"} ${plural(r.activeCustomers, "cliente", "clientes")} (${plural(r.visits, "visita", "visitas")} en total).`,
  );
  if (r.newCustomers) out.push(`Se inscribieron ${plural(r.newCustomers, "cliente nuevo", "clientes nuevos")}.`);
  if (r.returningCustomers) out.push(`${plural(r.returningCustomers, "cliente volvió", "clientes volvieron")} después de haber venido antes.`);
  if (r.remindersSent) {
    out.push(
      r.remindersReturned
        ? `Los recordatorios automáticos trajeron de vuelta a ${plural(r.remindersReturned, "cliente", "clientes")} (de ${r.remindersSent} enviados).`
        : `Se enviaron ${plural(r.remindersSent, "recordatorio", "recordatorios")} a clientes que no venían.`,
    );
  }
  if (r.redemptions) out.push(`Entregaste ${plural(r.redemptions, "premio", "premios")}.`);
  if (r.bestWeekday !== null) out.push(`Tu mejor día fue el ${WEEKDAY_NAMES[r.bestWeekday]}.`);
  return out;
}

/** Texto para compartir por WhatsApp. */
export function reportText(r: MonthlyReport, businessName: string): string {
  const lines = [`*${businessName} · Reporte de ${r.label}*${r.partial ? " (parcial)" : ""}`, "", ...reportHighlights(r).map((h) => `• ${h}`)];
  if (r.topCustomers.length) {
    lines.push("", "*Mejores clientes*", ...r.topCustomers.map((c, i) => `${i + 1}. ${c.name} · ${plural(c.visits, "visita", "visitas")}`));
  }
  if (r.coolingCount) lines.push("", `${plural(r.coolingCount, "cliente vino", "clientes vinieron")} el mes anterior y ${r.partial ? "aún no" : "no"} ha${r.coolingCount === 1 ? "" : "n"} vuelto.`);
  lines.push("", "Hecho con Lazo");
  return lines.join("\n");
}
