/**
 * Pase de billetera independiente del proveedor. Google Wallet lo usa hoy y
 * Apple Wallet (PKPASS) usará el mismo contenido: solo cambia cómo se empaqueta.
 */
import type { PublicCardData } from "@/components/public/card-screen";

export interface WalletPass {
  /** Token público de la tarjeta: identifica el pase sin exponer IDs internos. */
  token: string;
  cardUrl: string;
  active: boolean;
  customerName: string;
  business: { name: string; slug: string; logoText: string; background: string; foreground: string; logoUrl: string };
  program: { name: string; stampsRequired: number; rewardName: string };
  stamps: number;
  rewardsAvailable: { name: string; birthday: boolean }[];
  promotion: { name: string; bonusStamps: number } | null;
}

export function passFromCard(card: PublicCardData, origin: string): WalletPass {
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
    },
    program: card.program,
    stamps: Math.min(card.stamps, card.program.stampsRequired),
    rewardsAvailable: card.rewards.map((r) => ({ name: r.name, birthday: r.kind === "birthday" })),
    promotion: card.promotion ?? null,
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
