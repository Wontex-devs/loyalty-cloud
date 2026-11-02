import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicBusiness, getPublicCard } from "@/lib/data/public";
import { googleWalletConfig } from "./config";
import { updateClass, updateObject } from "./google";
import { passFromCard } from "./pass";

const origin = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

/**
 * Actualiza los pases de billetera de una tarjeta después de responder (no frena la caja).
 * Si la clienta no guardó el pase, Google responde 404 y no se hace nada.
 */
export function scheduleCardWalletSync(cardId: string) {
  if (!googleWalletConfig()) return;
  after(async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("loyalty_cards").select("public_token").eq("id", cardId).maybeSingle();
      if (!data?.public_token) return;
      const card = await getPublicCard(data.public_token);
      const cfg = googleWalletConfig();
      if (card && cfg) await updateObject(cfg, passFromCard(card, origin()));
    } catch (e) {
      console.error("[wallet] no se pudo actualizar el pase", e);
    }
  });
}

/** Actualiza el diseño común (nombre, logo, color) cuando el comercio cambia su marca o programa. */
export function scheduleBusinessWalletSync(businessId: string) {
  if (!googleWalletConfig()) return;
  after(async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("businesses").select("slug").eq("id", businessId).maybeSingle();
      const b = data?.slug ? await getPublicBusiness(data.slug) : null;
      const cfg = googleWalletConfig();
      if (!b || !cfg) return;
      await updateClass(cfg, {
        business: {
          name: b.name,
          slug: b.slug,
          logoText: b.branding.logoText,
          background: b.branding.cardBackground,
          foreground: b.branding.cardForeground,
          logoUrl: `${origin()}/join/${b.slug}/icon/660`,
        },
        program: { name: b.program.name, stampsRequired: b.program.stampsRequired, rewardName: b.program.rewardName },
      });
    } catch (e) {
      console.error("[wallet] no se pudo actualizar el diseño del pase", e);
    }
  });
}
