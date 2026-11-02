/** Promociones (p. ej. doble sello). En live las evalúa Postgres; en demo, este módulo. */
import type { Promotion } from "./types";

/** Fecha local AAAA-MM-DD y día ISO de la semana (1 = lunes … 7 = domingo). */
export function localDay(now = new Date(), timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const iso = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: iso, month: Number(get("month")), year: Number(get("year")) };
}

/** La promoción vigente hoy (la de más sellos si coinciden varias), o null. */
export function activePromotion(promotions: Promotion[], now = new Date(), timeZone?: string): Promotion | null {
  const { date, weekday } = localDay(now, timeZone);
  return (
    promotions
      .filter((p) => p.active && p.startsOn <= date && date <= p.endsOn && p.weekdays.includes(weekday))
      .sort((a, b) => b.bonusStamps - a.bonusStamps || a.createdAt.localeCompare(b.createdAt))[0] ?? null
  );
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** "Doble sello", "Triple sello"… según los sellos extra. */
export const bonusLabel = (bonus: number) => ["", "Doble sello", "Triple sello", "Cuádruple sello", "Quíntuple sello"][bonus] ?? `+${bonus} sellos`;
