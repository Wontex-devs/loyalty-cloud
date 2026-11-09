"use server";

/**
 * Server Actions del toque NFC: la clienta acerca el celular a la etiqueta del mostrador y se registra su visita,
 * y el panel enciende o actualiza la etiqueta. Las reglas viven en Postgres (register_nfc_visit, set_nfc_settings).
 */
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleCardWalletSync } from "@/lib/wallet/sync";
import { dbErrorMessage } from "./errors";
import { getPublicCard } from "./public";
import { rateLimit } from "./rate-limit";

const tapInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  secret: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  cardToken: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  idempotencyKey: z.string().min(8).max(100),
});

export type NfcTapResult =
  | {
      ok: true;
      businessName: string;
      stamps: number;
      required: number;
      rewardName: string;
      /** Se ganó un premio con esta visita (o hay uno disponible). */
      rewardReady: boolean;
    }
  | { ok: false; message: string };

/** Registra la visita de quien acercó el celular a la etiqueta. Sin sesión: solo el servidor puede llamar a la base. */
export async function nfcTapAction(slug: string, secret: string, cardToken: string, idempotencyKey: string): Promise<NfcTapResult> {
  const parsed = tapInput.safeParse({ slug, secret, cardToken, idempotencyKey });
  if (!parsed.success) return { ok: false, message: "Este enlace no es válido. Acerca el celular a la etiqueta de nuevo." };

  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // Frenos rápidos en este servidor; el que cuenta es el tiempo mínimo entre visitas en Postgres.
  if (!rateLimit(`nfc-ip:${ip}`, 30, 10 * 60_000) || !rateLimit(`nfc-card:${parsed.data.cardToken}`, 8, 60 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("register_nfc_visit", {
    p_slug: parsed.data.slug,
    p_secret: parsed.data.secret,
    p_card_token: parsed.data.cardToken,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { ok: false, message: dbErrorMessage(error, "No pudimos registrar tu visita. Inténtalo de nuevo.") };

  const res = data as { card_id: string; reward_id: string | null; birthday_reward_id?: string | null };
  scheduleCardWalletSync(
    res.card_id,
    { idempotencyKey: parsed.data.idempotencyKey, rewardEarned: !!res.reward_id, birthdayReward: !!res.birthday_reward_id },
    { service: true },
  );

  const card = await getPublicCard(parsed.data.cardToken);
  if (!card) return { ok: false, message: "Se registró tu visita, pero no pudimos abrir tu tarjeta. Ábrela desde tu enlace." };
  return {
    ok: true,
    businessName: card.business.name,
    stamps: Math.min(card.stamps, card.program.stampsRequired),
    required: card.program.stampsRequired,
    rewardName: card.program.rewardName,
    rewardReady: card.rewards.length > 0,
  };
}

// ---------- Panel: ajustes de la etiqueta ----------

export type NfcSettings = { enabled: boolean; secret: string; minMinutes: number };
export type NfcSettingsResult = { ok: true; settings: NfcSettings } | { ok: false; message: string };

const toSettings = (d: { enabled: boolean; secret: string; min_minutes: number }): NfcSettings => ({
  enabled: d.enabled,
  secret: d.secret,
  minMinutes: d.min_minutes,
});

export async function getNfcSettingsAction(businessId: string): Promise<NfcSettingsResult> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Establecimiento no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_nfc_settings", { p_business_id: businessId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, settings: toSettings(data as never) };
}

export async function setNfcSettingsAction(businessId: string, enabled: boolean, minMinutes: number, rotate = false): Promise<NfcSettingsResult> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Establecimiento no válido." };
  if (!Number.isInteger(minMinutes) || minMinutes < 0 || minMinutes > 1440) return { ok: false, message: "Revisa el tiempo mínimo entre toques." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_nfc_settings", {
    p_business_id: businessId,
    p_enabled: enabled,
    p_min_minutes: minMinutes,
    p_rotate: rotate,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, settings: toSettings(data as never) };
}
