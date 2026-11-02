import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

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
