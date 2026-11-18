import "server-only";
import { connect } from "node:http2";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicCard } from "@/lib/data/public";
import { businessIcon, businessWordmark } from "@/components/brand/business-icon";
import { CARD_FONT_STYLES } from "@/components/loyalty/brand-mark";
import { cardTheme } from "@/lib/domain/card-palette";
import { walletFonts } from "./fonts";
import { passStrip, type PassStripInput } from "@/components/brand/pass-strip";
import { buildPkpass, type AppleWalletConfig, type PassMessage } from "./apple";
import { walletSettings } from "./messages";
import { passFromCard } from "./pass";
import { businessPassData } from "./places-server";

/** Mensajes del comercio que se muestran al reverso del pase (no los de cada visita). */
const MESSAGE_KINDS = ["campaign", "birthday", "winback"];
const MESSAGE_DAYS = 30;

export const appOrigin = (req?: Request) => (process.env.NEXT_PUBLIC_APP_URL ?? (req ? new URL(req.url).origin : "")).replace(/\/$/, "");

/** Tarjeta (id interno y comercio) a partir del número de serie del pase, que es su token público. */
export async function cardBySerial(serial: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(serial)) return null;
  const { data } = await createAdminClient().from("loyalty_cards").select("id, business_id, customer_id").eq("public_token", serial).maybeSingle();
  return data ? { cardId: data.id as string, businessId: data.business_id as string, customerId: data.customer_id as string } : null;
}

async function png(res: Response) {
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Imágenes del pase en 1x, 2x y 3x: icono (notificaciones y pantalla de bloqueo), logo con el
 * nombre en la letra de la marca y la franja con la foto, el título y los sellos.
 */
async function passImages(business: Parameters<typeof businessWordmark>[0], strip: PassStripInput) {
  const scales = [1, 2, 3];
  const file = (name: string, scale: number) => `${name}${scale === 1 ? "" : `@${scale}x`}.png`;
  const font = (business.branding.font ?? "serif") as keyof typeof CARD_FONT_STYLES;
  const fonts = await walletFonts(font);
  const color = cardTheme({ cardBackground: business.branding.cardBackground, cardForeground: business.branding.cardForeground }).text;
  const upper = (CARD_FONT_STYLES[font] ?? CARD_FONT_STYLES.serif).upper;
  const entries = await Promise.all([
    ...scales.map(async (scale) => [file("icon", scale), await png(businessIcon(business, 29 * scale))] as const),
    // Logo: 160 × 50 puntos como máximo.
    ...scales.map(async (scale) => [file("logo", scale), await png(businessWordmark(business, 160 * scale, 50 * scale, { color, upper, fonts }))] as const),
    // Franja de la tarjeta de tienda: 375 × 144 puntos.
    ...scales.map(async (scale) => [file("strip", scale), await png(passStrip(strip, 375 * scale, 144 * scale, { fonts }))] as const),
  ]);
  return Object.fromEntries(entries);
}

async function latestMessage(cardId: string): Promise<PassMessage | null> {
  const since = new Date(Date.now() - MESSAGE_DAYS * 86_400_000).toISOString();
  const { data } = await createAdminClient()
    .from("wallet_notifications")
    .select("title, body")
    .eq("card_id", cardId)
    .in("kind", MESSAGE_KINDS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function firstNameOf(customerId: string) {
  const { data } = await createAdminClient().from("customers").select("first_name").eq("id", customerId).maybeSingle();
  return (data?.first_name as string | null | undefined) ?? null;
}

async function businessSettings(businessId: string) {
  const { data } = await createAdminClient().from("businesses").select("wallet_notifications").eq("id", businessId).maybeSingle();
  return walletSettings(data?.wallet_notifications);
}

/** El .pkpass firmado de una tarjeta, o null si no existe. */
export async function pkpassFor(cfg: AppleWalletConfig, token: string, origin: string) {
  const card = await getPublicCard(token);
  if (!card) return null;
  const ids = await cardBySerial(token);
  const [images, message, settings, extra, firstName] = await Promise.all([
    passImages(card.business, {
      branding: card.business.branding,
      monogram: card.business.name,
      upper: (CARD_FONT_STYLES[card.business.branding.font ?? "serif"] ?? CARD_FONT_STYLES.serif).upper,
      stamps: Math.min(card.stamps, card.program.stampsRequired),
      required: card.program.stampsRequired,
      ...stripReward(card),
    }),
    ids ? latestMessage(ids.cardId) : null,
    ids ? businessSettings(ids.businessId) : null,
    ids ? businessPassData({ businessId: ids.businessId }) : undefined,
    ids ? firstNameOf(ids.customerId) : null,
  ]);
  return buildPkpass(cfg, passFromCard(card, origin, extra?.places, extra?.info), origin, images, { message, settings, firstName });
}

export function pkpassResponse(pass: Buffer, token: string) {
  return new Response(new Uint8Array(pass), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="tarjeta-${token.slice(0, 8)}.pkpass"`,
      "Last-Modified": new Date().toUTCString(),
      "Cache-Control": "no-store",
    },
  });
}

// ---------- Avisos por APNs ----------

const APNS_HOST = "https://api.push.apple.com";

/**
 * Avisa a los iPhone que el pase cambió (cuerpo vacío, tema = Pass Type ID): el iPhone
 * descarga el pase nuevo y muestra el changeMessage del campo que cambió.
 * Devuelve los tokens entregados (200) y los que Apple da por muertos (410), para borrarlos.
 */
async function pushApns(cfg: AppleWalletConfig, tokens: string[]) {
  const dead: string[] = [];
  const delivered: string[] = [];
  if (!tokens.length) return { dead, delivered };
  const client = connect(APNS_HOST, { cert: cfg.certPem, key: cfg.keyPem, passphrase: cfg.keyPassphrase });
  client.on("error", (e) => console.error("[apple-wallet] conexión APNs", e));
  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({ ":method": "POST", ":path": `/3/device/${token}`, "apns-topic": cfg.passTypeId, "content-type": "application/json" });
            req.setTimeout(10_000, () => req.close());
            req.on("response", (h) => {
              const status = Number(h[":status"]);
              if (status === 200) delivered.push(token);
              else if (status === 410) dead.push(token);
              else if (status !== 200) console.error(`[apple-wallet] APNs respondió ${status}`);
            });
            req.on("error", (e) => console.error("[apple-wallet] aviso APNs", e));
            req.on("close", () => resolve());
            req.resume();
            req.end("{}");
          }),
      ),
    );
  } finally {
    client.close();
  }
  return { dead, delivered };
}

/**
 * Marca como cambiados los pases de estas tarjetas (o de todo un comercio) y avisa a sus iPhone.
 * Devuelve las tarjetas con al menos un iPhone que recibió el aviso.
 */
export async function notifyApplePasses(cfg: AppleWalletConfig, target: { cardIds: string[] } | { businessId: string }): Promise<Set<string>> {
  const reached = new Set<string>();
  if ("cardIds" in target && !target.cardIds.length) return reached;
  const admin = createAdminClient();
  let q = admin.from("apple_wallet_registrations").update({ pass_updated_at: new Date().toISOString() });
  q = "businessId" in target ? q.eq("business_id", target.businessId) : q.in("card_id", target.cardIds);
  const { data, error } = await q.select("card_id, push_token");
  if (error) throw new Error(`apple_wallet_registrations: ${error.message}`);
  const tokens = [...new Set((data ?? []).map((r) => r.push_token as string))];
  const dead: string[] = [];
  const delivered = new Set<string>();
  // De a 500 por conexión: muy por debajo del límite de flujos simultáneos de APNs.
  for (let i = 0; i < tokens.length; i += 500) {
    const r = await pushApns(cfg, tokens.slice(i, i + 500));
    dead.push(...r.dead);
    r.delivered.forEach((t) => delivered.add(t));
  }
  if (dead.length) await admin.from("apple_wallet_registrations").delete().in("push_token", dead);
  for (const r of data ?? []) if (delivered.has(r.push_token as string)) reached.add(r.card_id as string);
  return reached;
}

/** Recompensa que muestra la franja: la lista para canjear o la del programa. */
export function stripReward(card: { program: { rewardName: string }; rewards: { name: string }[] }) {
  return card.rewards.length ? { rewardName: card.rewards[0].name, rewardReady: true } : { rewardName: card.program.rewardName, rewardReady: false };
}
