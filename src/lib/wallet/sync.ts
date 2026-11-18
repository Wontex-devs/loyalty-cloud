import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBusiness, getPublicCard } from "@/lib/data/public";
import { appleWalletConfig, googleWalletConfig } from "./config";
import { notifyApplePasses } from "./apple-server";
import { listObjects, savedTokens, updateClass, updateObject } from "./google";
import { visitNotice, walletSettings } from "./messages";
import { deliverNotices, queueNotices } from "./notify";
import { passFromCard } from "./pass";
import { businessPassData } from "./places-server";

/** Datos de una visita recién registrada, para su aviso (sello nuevo, te falta 1 o premio listo). */
export interface VisitNoticeInput {
  idempotencyKey: string;
  rewardEarned: boolean;
  birthdayReward: boolean;
}

const origin = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

/**
 * Actualiza los pases de billetera de una tarjeta después de responder (no frena la caja)
 * y, tras una visita, le envía su aviso. Si el cliente no guardó el pase, Google responde 404.
 */
export function scheduleCardWalletSync(cardId: string, visit?: VisitNoticeInput, opts?: { service?: boolean }) {
  if (!googleWalletConfig() && !appleWalletConfig()) return;
  after(async () => {
    try {
      // Apple: se avisa a los iPhone y cada uno descarga el pase nuevo; el aviso de la visita
      // sale del propio pase (el campo de progreso cambia y muestra su mensaje).
      const apple = appleWalletConfig();
      const reachedApple = apple
        ? (await notifyApplePasses(apple, { cardIds: [cardId] }).catch((e) => (console.error("[wallet] no se pudo avisar a Apple Wallet", e), new Set<string>()))).has(cardId)
        : false;

      // El toque NFC no trae sesión de empleado: ahí se lee la tarjeta con la clave del servidor.
      const supabase = opts?.service ? createAdminClient() : await createClient();
      const { data } = await supabase.from("loyalty_cards").select("public_token, business_id").eq("id", cardId).maybeSingle();
      if (!data?.public_token) return;
      const card = await getPublicCard(data.public_token);
      if (!card) return;
      const cfg = googleWalletConfig();
      const saved = cfg ? await updateObject(cfg, passFromCard(card, origin())) : false;
      // El aviso de la visita queda registrado si le llegó por alguna de las dos billeteras.
      if (visit && (saved || reachedApple)) {
        await notifyVisit(cardId, data.business_id, card, visit, reachedApple ? new Set([card.token]) : new Set());
      }
    } catch (e) {
      console.error("[wallet] no se pudo actualizar el pase", e);
    }
  });
}

async function notifyVisit(
  cardId: string,
  businessId: string,
  card: NonNullable<Awaited<ReturnType<typeof getPublicCard>>>,
  visit: VisitNoticeInput,
  appleReached: Set<string>,
) {
  const { data: biz } = await createAdminClient().from("businesses").select("wallet_notifications").eq("id", businessId).maybeSingle();
  const rewards = card.rewards;
  const notice = visitNotice(walletSettings(biz?.wallet_notifications), {
    businessName: card.business.name,
    stamps: Math.min(card.stamps, card.program.stampsRequired),
    required: card.program.stampsRequired,
    rewardName: card.program.rewardName,
    rewardEarned: visit.rewardEarned ? (rewards.find((r) => r.kind !== "birthday")?.name ?? card.program.rewardName) : null,
    birthdayReward: visit.birthdayReward ? (rewards.find((r) => r.kind === "birthday")?.name ?? "regalo de cumpleaños") : null,
  });
  if (!notice) return;
  const queued = await queueNotices([{ businessId, cardId, token: card.token, ref: `visit:${visit.idempotencyKey}`, notice }]);
  await deliverNotices(queued, { appleReached });
}

/** Actualiza el diseño común (nombre, logo, color) cuando el comercio cambia su marca o programa. */
export function scheduleBusinessWalletSync(businessId: string) {
  if (!googleWalletConfig() && !appleWalletConfig()) return;
  after(async () => {
    const apple = appleWalletConfig();
    if (apple) await notifyApplePasses(apple, { businessId }).catch((e) => console.error("[wallet] no se pudo avisar a Apple Wallet", e));
    if (!googleWalletConfig()) return;
    try {
      // Sin sesión (p. ej. desde el lector NFC) se lee con la clave del servidor.
      const { data } = await createAdminClient().from("businesses").select("slug").eq("id", businessId).maybeSingle();
      const [b, extra] = data?.slug ? await Promise.all([getPublicBusiness(data.slug), businessPassData({ businessId })]) : [null, undefined];
      const places = extra?.places;
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
          coverUrl: b.branding.coverUrl || undefined,
          style: b.branding.cardStyle,
        },
        program: { name: b.program.name, stampsRequired: b.program.stampsRequired, rewardName: b.program.rewardName },
        places,
        info: extra?.info,
      });
      // Cada pase guardado lleva su imagen de sellos y su color: se actualizan todos.
      const tokens = [...savedTokens(cfg, await listObjects(cfg, b.slug))];
      for (let i = 0; i < tokens.length; i += 5) {
        await Promise.all(
          tokens.slice(i, i + 5).map(async (token) => {
            const card = await getPublicCard(token);
            if (card) await updateObject(cfg, passFromCard(card, origin(), places)).catch((e) => console.error("[wallet] pase de Google", e));
          }),
        );
      }
    } catch (e) {
      console.error("[wallet] no se pudo actualizar el diseño del pase", e);
    }
  });
}
