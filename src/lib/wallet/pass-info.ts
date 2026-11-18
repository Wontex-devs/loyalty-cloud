/**
 * Información del comercio al reverso del pase (Apple) y en sus enlaces (Google):
 * WhatsApp para reservar, Instagram, sitio web, horario y cómo llegar.
 * Lo escribe el comercio en el panel; la dirección sale de sus ajustes y sedes.
 */
import type { Place } from "./geo.ts";

/** Lo que guarda el comercio (businesses.pass_info). Todo opcional. */
export interface PassInfoInput {
  whatsapp?: string;
  instagram?: string;
  website?: string;
  hours?: string;
}

/** Lo que va en el pase: lo anterior más la dirección y el enlace al mapa. */
export interface PassInfo extends PassInfoInput {
  address?: string;
  mapsUrl?: string;
}

export const HOURS_MAX = 300;

/** Deja un número de WhatsApp como +57…: acepta espacios, guiones y celulares de Colombia sin indicativo. */
export function normalizeWhatsapp(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, "");
  const full = t.startsWith("+") ? digits : digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
  return /^[0-9]{7,15}$/.test(full) ? `+${full}` : null;
}

/** Usuario de Instagram sin @ ni enlace: «@prueba.salon» o «instagram.com/prueba.salon» → «prueba.salon». */
export function normalizeInstagram(raw: string): string | null {
  const t = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (!t) return null;
  return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : null;
}

/** Sitio web siempre con https://. */
export function normalizeWebsite(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const url = /^https?:\/\//i.test(t) ? t.replace(/^http:\/\//i, "https://") : `https://${t}`;
  if (!/^https:\/\/[^\s<>"]{3,200}$/.test(url)) return null;
  try {
    // Debe ser un dominio de verdad (con punto), no «https://javascript:…».
    return new URL(url).hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

type Normalized = { ok: true; info: PassInfoInput } | { ok: false; message: string };

/** Valida y limpia lo que escribió el comercio. Los campos vacíos se quitan. */
export function normalizePassInfo(raw: { whatsapp?: string; instagram?: string; website?: string; hours?: string }): Normalized {
  const info: PassInfoInput = {};
  if (raw.whatsapp?.trim()) {
    const w = normalizeWhatsapp(raw.whatsapp);
    if (!w) return { ok: false, message: "Revisa el WhatsApp: escribe el número con su indicativo, por ejemplo +57 300 123 4567." };
    info.whatsapp = w;
  }
  if (raw.instagram?.trim()) {
    const i = normalizeInstagram(raw.instagram);
    if (!i) return { ok: false, message: "Revisa el Instagram: escribe solo el usuario, por ejemplo prueba.salon." };
    info.instagram = i;
  }
  if (raw.website?.trim()) {
    const w = normalizeWebsite(raw.website);
    if (!w) return { ok: false, message: "Revisa el sitio web, por ejemplo www.tusalon.com." };
    info.website = w;
  }
  const h = raw.hours?.trim();
  if (h) {
    if (h.length < 3 || h.length > HOURS_MAX) return { ok: false, message: `El horario admite entre 3 y ${HOURS_MAX} caracteres.` };
    info.hours = h;
  }
  return { ok: true, info };
}

/** Lee pass_info de la base de datos sin confiar en su forma. */
export function passInfoFrom(v: unknown): PassInfoInput {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : undefined);
  return { whatsapp: s("whatsapp"), instagram: s("instagram"), website: s("website"), hours: s("hours") };
}

/** Enlace al mapa: la primera sede con ubicación o, si no hay, la dirección escrita. */
export function mapsUrl(places: Place[] | undefined, address?: string, city?: string) {
  const p = places?.[0];
  if (p) return `https://maps.google.com/?q=${p.latitude},${p.longitude}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, city].filter(Boolean).join(", "))}`;
  return undefined;
}

export const whatsappLink = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;
export const instagramLink = (u: string) => `https://instagram.com/${u}`;
/** «+573001234567» → «+57 300 123 4567» para leerlo fácil. */
export function prettyPhone(n: string) {
  const d = n.replace(/\D/g, "");
  return d.startsWith("57") && d.length === 12 ? `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`;
}
const host = (url: string) => url.replace(/^https:\/\//, "").replace(/\/$/, "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Campos del reverso del pase de Apple (en orden). Los enlaces se pueden tocar. */
export function appleInfoFields(info: PassInfo | undefined) {
  if (!info) return [];
  const f: Record<string, unknown>[] = [];
  if (info.whatsapp)
    f.push({ key: "whatsapp", label: "Reserva por WhatsApp", value: prettyPhone(info.whatsapp), attributedValue: `<a href="${esc(whatsappLink(info.whatsapp))}">${esc(prettyPhone(info.whatsapp))}</a>` });
  if (info.instagram)
    f.push({ key: "instagram", label: "Instagram", value: `@${info.instagram}`, attributedValue: `<a href="${esc(instagramLink(info.instagram))}">@${esc(info.instagram)}</a>` });
  if (info.address || info.mapsUrl) {
    const text = info.address ?? "Ver en el mapa";
    f.push({ key: "address", label: "Cómo llegar", value: text, ...(info.mapsUrl ? { attributedValue: `<a href="${esc(info.mapsUrl)}">${esc(text)}</a>` } : {}) });
  }
  if (info.hours) f.push({ key: "hours", label: "Horario", value: info.hours });
  if (info.website) f.push({ key: "website", label: "Sitio web", value: host(info.website), attributedValue: `<a href="${esc(info.website)}">${esc(host(info.website))}</a>` });
  return f;
}

/** Enlaces y textos del pase de Google (van en la clase: son los mismos para todos los clientes). */
export function googleInfoModules(info: PassInfo | undefined) {
  if (!info) return { links: [], texts: [] };
  const links: { id: string; uri: string; description: string }[] = [];
  if (info.whatsapp) links.push({ id: "whatsapp", uri: whatsappLink(info.whatsapp), description: "Reserva por WhatsApp" });
  if (info.instagram) links.push({ id: "instagram", uri: instagramLink(info.instagram), description: `Instagram @${info.instagram}` });
  if (info.mapsUrl) links.push({ id: "maps", uri: info.mapsUrl, description: info.address ? `Cómo llegar: ${info.address}` : "Cómo llegar" });
  if (info.website) links.push({ id: "website", uri: info.website, description: host(info.website) });
  const texts = info.hours ? [{ id: "hours", header: "Horario", body: info.hours }] : [];
  return { links, texts };
}
