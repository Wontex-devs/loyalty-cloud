import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/**
 * Las fechas se muestran siempre en hora de Colombia. Sin zona fija, el servidor (en UTC) y el
 * celular o computador del usuario escriben fechas distintas cerca de la medianoche, y React
 * rechaza la página al cargarla (error #418).
 */
export const ZONA_HORARIA = "America/Bogota";
/** Colombia está en UTC−5 todo el año (no cambia de horario). */
const DESFASE_COLOMBIA = 5 * 3_600_000;
const DIA = 86_400_000;

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA_HORARIA });
const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});
const dayLabelFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

/** Número de día (desde 1970) en hora de Colombia, igual en el servidor y en el navegador. */
export const diaColombia = (t: number | string | Date) => Math.floor((new Date(t).getTime() - DESFASE_COLOMBIA) / DIA);

export interface SeriesPoint {
  label: string;
  value: number;
}

/** Serie diaria de los últimos `days` días (en hora de Colombia) a partir de fechas ISO. */
export function dailySeries(dates: string[], days: number, now = new Date()): SeriesPoint[] {
  const start = diaColombia(now) - (days - 1);
  const buckets = new Array(days).fill(0);
  for (const iso of dates) {
    const idx = diaColombia(iso) - start;
    if (idx >= 0 && idx < days) buckets[idx]++;
  }
  return buckets.map((value, i) => ({ label: dayLabelFmt.format(new Date((start + i) * DIA)), value }));
}

/** Los últimos `n` meses (el actual al final) en hora de Colombia: clave «2026-11» y nombre corto. */
export function ultimosMeses(n: number, now = new Date()) {
  const hoy = new Date(now.getTime() - DESFASE_COLOMBIA);
  const fmt = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (n - 1 - i), 1));
    return { clave: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, nombre: fmt.format(d) };
  });
}

export const formatDate = (iso?: string) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const formatDateTime = (iso?: string) => (iso ? dateTimeFmt.format(new Date(iso)) : "—");

export function formatRelative(iso: string | undefined, now = new Date()) {
  if (!iso) return "—";
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  return formatDate(iso);
}

export const formatMoney = (n: number, currency = "COP") =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const formatNumber = (n: number) => new Intl.NumberFormat("es-CO").format(n);

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
