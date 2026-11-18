/**
 * Pase de billetera independiente del proveedor. Google Wallet lo usa hoy y
 * Apple Wallet (PKPASS) usará el mismo contenido: solo cambia cómo se empaqueta.
 */
import type { PublicCardData } from "@/components/public/card-screen";
import type { Place } from "./geo.ts";
import { cardTheme } from "../domain/card-palette.ts";
import type { CardFont, CardStyle, StampIcon } from "../domain/types.ts";

export interface WalletPass {
  /** Token público de la tarjeta: identifica el pase sin exponer IDs internos. */
  token: string;
  cardUrl: string;
  active: boolean;
  customerName: string;
  business: { name: string; slug: string; logoText: string; background: string; foreground: string; logoUrl: string; coverUrl?: string; stampIcon?: StampIcon; stampUrl?: string; style?: CardStyle; font?: CardFont };
  program: { name: string; stampsRequired: number; rewardName: string };
  stamps: number;
  rewardsAvailable: { name: string; birthday: boolean }[];
  promotion: { name: string; bonusStamps: number } | null;
  /** Sedes con ubicación: el celular avisa al estar cerca. undefined = no se consultaron. */
  places?: Place[];
}

export function passFromCard(card: PublicCardData, origin: string, places?: Place[]): WalletPass {
  const slug = card.business.slug ?? "";
  const b = card.business.branding;
  return {
    token: card.token,
    cardUrl: `${origin}/card/${card.token}`,
    active: card.status !== "blocked",
    customerName: card.customerName,
    business: {
      name: card.business.name,
      slug,
      logoText: b.logoText,
      background: b.cardBackground,
      foreground: b.cardForeground,
      logoUrl: `${origin}/join/${slug}/icon/660`,
      coverUrl: b.coverUrl || undefined,
      stampIcon: b.stampIcon,
      stampUrl: b.stampUrl || undefined,
      style: b.cardStyle,
      font: b.font,
    },
    program: card.program,
    stamps: Math.min(card.stamps, card.program.stampsRequired),
    rewardsAvailable: card.rewards.map((r) => ({ name: r.name, birthday: r.kind === "birthday" })),
    promotion: card.promotion ?? null,
    ...(places ? { places } : {}),
  };
}

/** Texto de progreso común a todas las billeteras. */
export function progressText(p: WalletPass) {
  if (p.rewardsAvailable.length) {
    const r = p.rewardsAvailable[0];
    return r.birthday ? `🎂 Tienes un regalo de cumpleaños: ${r.name}. Muestra este pase en caja.` : `🎁 Tienes tu ${r.name}. Muestra este pase en caja.`;
  }
  const left = Math.max(p.program.stampsRequired - p.stamps, 0);
  return `Te ${left === 1 ? "falta 1 visita" : `faltan ${left} visitas`} para: ${p.program.rewardName}.`;
}

/** Versión de la imagen de sellos: cambia con cada sello y con el diseño de la tarjeta. */
export function stripVersion(p: Pick<WalletPass, "stamps" | "program" | "business" | "rewardsAvailable">) {
  const design = ["minimal-1", p.business.background, p.business.foreground, p.program.rewardName, p.rewardsAvailable.length ? "ready" : ""].join("|");
  let h = 0;
  for (const ch of design) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return `${p.stamps}-${p.program.stampsRequired}-${(h >>> 0).toString(36)}`;
}

/** URL pública de la imagen de sellos (Google Wallet la descarga y la guarda). */
export const stripUrl = (p: WalletPass) => `${p.cardUrl}/sellos/${stripVersion(p)}`;

/** Colores del pase en la billetera: exactamente el color 1 (fondo) y el color 2 (acento) del comercio. */
export const passTheme = (p: Pick<WalletPass, "business">) =>
  cardTheme({ cardBackground: p.business.background, cardForeground: p.business.foreground });
