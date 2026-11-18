import { getPublicCard } from "@/lib/data/public";
import { passStrip } from "@/components/brand/pass-strip";
import { walletFonts } from "@/lib/wallet/fonts";
import { stripReward } from "@/lib/wallet/apple-server";
import { CARD_FONT_STYLES } from "@/components/loyalty/brand-mark";

type Ctx = { params: Promise<{ token: string; v: string }> };

/**
 * Imagen con los sellos de la tarjeta para Google Wallet (imagen principal del pase).
 * `v` cambia con cada sello o cambio de diseño: así Google descarga la imagen nueva.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const card = /^[A-Za-z0-9_-]{8,64}$/.test(token) ? await getPublicCard(token) : null;
  if (!card) return new Response("No encontrada", { status: 404 });
  const required = card.program.stampsRequired;
  const fonts = await walletFonts(card.business.branding.font);
  const b = card.business.branding;
  const upper = (CARD_FONT_STYLES[b.font ?? "serif"] ?? CARD_FONT_STYLES.serif).upper;
  return passStrip({ branding: b, stamps: Math.min(card.stamps, required), required, monogram: card.business.name, upper, ...stripReward(card) }, 1032, 336, {
    headers: { "Cache-Control": "public, max-age=3600" },
    fonts,
  });
}
