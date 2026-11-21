import { getPublicCard } from "@/lib/data/public";
import { passStrip } from "@/components/brand/pass-strip";
import { walletFonts } from "@/lib/wallet/fonts";
import { stripReward } from "@/lib/wallet/apple-server";
import { imagenEnCache } from "@/lib/wallet/imagenes-cache";
import { CARD_FONT_STYLES } from "@/components/loyalty/brand-mark";

type Ctx = { params: Promise<{ token: string; v: string }> };

/**
 * Imagen con los sellos de la tarjeta para Google Wallet (imagen principal del pase).
 * `v` cambia con cada sello o cambio de diseño: así Google descarga la imagen nueva.
 * El dibujo se guarda: todas las tarjetas del mismo comercio con los mismos sellos comparten imagen.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const card = /^[A-Za-z0-9_-]{8,64}$/.test(token) ? await getPublicCard(token) : null;
  if (!card) return new Response("No encontrada", { status: 404 });
  const required = card.program.stampsRequired;
  const b = card.business.branding;
  const font = b.font ?? "serif";
  const upper = (CARD_FONT_STYLES[font] ?? CARD_FONT_STYLES.serif).upper;
  const strip = { branding: b, stamps: Math.min(card.stamps, required), required, monogram: card.business.name, upper, ...stripReward(card) };
  const png = await imagenEnCache(["google-strip", font, strip], async () =>
    Buffer.from(await passStrip(strip, 1032, 336, { fonts: await walletFonts(b.font) }).arrayBuffer()),
  );
  return new Response(new Uint8Array(png), {
    // La dirección cambia cuando cambia la imagen (`v`), así que se puede guardar un día entero.
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, immutable" },
  });
}
