"use server";

/**
 * Server Actions del toque NFC: el cliente acerca el celular a la etiqueta del mostrador y se registra su visita,
 * y el panel enciende o actualiza la etiqueta. Las reglas viven en Postgres (register_nfc_visit, set_nfc_settings).
 */
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleWalletConfig } from "@/lib/wallet/config";
import { scheduleBusinessWalletSync, scheduleCardWalletSync } from "@/lib/wallet/sync";
import { dbErrorMessage } from "./errors";
import { getPublicCard } from "./public";
import { normalizePhone } from "@/lib/domain/schemas";
import { recordarTarjeta, tarjetasRecordadas } from "./recordar-tarjeta";
import { rateLimit } from "./rate-limit";

const SLUG = z.string().regex(/^[a-z0-9-]{2,60}$/);
const SECRETO = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const TOKEN = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const CLAVE = z.string().min(8).max(100);
const tapInput = z.object({ slug: SLUG, secret: SECRETO, cardToken: TOKEN.nullable(), idempotencyKey: CLAVE });
const recuperarInput = z.object({
  slug: SLUG,
  secret: SECRETO,
  celular: z.string().trim().min(7).max(25),
  idempotencyKey: CLAVE,
});

/** Errores de la etiqueta o del negocio: con ellos no se recuerda la tarjeta ni se devuelve su enlace. */
const ERROR_DE_ETIQUETA = /INVALID_TAG|NFC_DISABLED|BUSINESS_SUSPENDED|BUSINESS_NOT_FOUND/;

export type NfcTapResult =
  | {
      ok: true;
      businessName: string;
      stamps: number;
      required: number;
      rewardName: string;
      /** Se ganó un premio con esta visita (o hay uno disponible). */
      rewardReady: boolean;
      /** Enlace de la tarjeta, para guardarlo también en este celular. Sin él si se sumó solo con el celular. */
      token?: string;
    }
  | {
      ok: false;
      message: string;
      /** La tarjeta sí es de este celular (p. ej. ya sumó su sello hace poco): se puede abrir. */
      token?: string;
      /** Este celular no tiene tarjeta guardada de este comercio: hay que confirmar los datos. */
      sinTarjeta?: true;
    };

const ipCliente = async () => {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
};

/** La tarjeta es de este comercio (un celular puede tener tarjetas de varios). */
async function tarjetaDelComercio(token: string, slug: string) {
  const card = await getPublicCard(token);
  return card?.business.slug === slug ? token : null;
}

/**
 * Registra la visita. Si la tarjeta salió de este celular (`recordar`), lo deja recordado y devuelve su enlace.
 * Si solo se escribió un número de celular, no: suma el sello pero no abre la tarjeta (con el número de otra
 * persona no se ve su nombre ni su historial) ni la guarda en este celular.
 */
async function registrarToque(slug: string, secret: string, cardToken: string, idempotencyKey: string, recordar = true): Promise<NfcTapResult> {
  if (!rateLimit(`nfc-card:${cardToken}`, 8, 60 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("register_nfc_visit", {
    p_slug: slug,
    p_secret: secret,
    p_card_token: cardToken,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const message = dbErrorMessage(error, "No pudimos registrar tu visita. Inténtalo de nuevo.");
    if (ERROR_DE_ETIQUETA.test(error.message ?? "") || !recordar) return { ok: false, message };
    await recordarTarjeta(cardToken);
    return { ok: false, message, token: cardToken };
  }

  const res = data as { card_id: string; reward_id: string | null; birthday_reward_id?: string | null };
  scheduleCardWalletSync(res.card_id, { idempotencyKey, rewardEarned: !!res.reward_id, birthdayReward: !!res.birthday_reward_id }, { service: true });
  if (recordar) await recordarTarjeta(cardToken);

  const card = await getPublicCard(cardToken);
  if (!card) return { ok: false, message: "Se registró tu visita, pero no pudimos abrir tu tarjeta. Ábrela desde tu enlace.", ...(recordar ? { token: cardToken } : {}) };
  return {
    ok: true,
    businessName: card.business.name,
    stamps: Math.min(card.stamps, card.program.stampsRequired),
    required: card.program.stampsRequired,
    rewardName: card.program.rewardName,
    rewardReady: card.rewards.length > 0,
    ...(recordar ? { token: cardToken } : {}),
  };
}

/**
 * Registra la visita de quien acercó el celular a la etiqueta. Sin sesión: solo el servidor puede llamar a la base.
 * Busca la tarjeta en lo que guardó la página (`cardToken`) y, si no está, en la cookie del servidor.
 */
export async function nfcTapAction(slug: string, secret: string, cardToken: string | null, idempotencyKey: string): Promise<NfcTapResult> {
  const parsed = tapInput.safeParse({ slug, secret, cardToken, idempotencyKey });
  if (!parsed.success) return { ok: false, message: "Este enlace no es válido. Acerca el celular a la etiqueta de nuevo." };
  // Frenos rápidos en este servidor; el que cuenta es el tiempo mínimo entre visitas en Postgres.
  if (!rateLimit(`nfc-ip:${await ipCliente()}`, 30, 10 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }

  const candidatas = [parsed.data.cardToken, ...(await tarjetasRecordadas())].filter((t, i, l): t is string => !!t && l.indexOf(t) === i);
  for (const t of candidatas) {
    const propia = await tarjetaDelComercio(t, parsed.data.slug);
    if (propia) return registrarToque(parsed.data.slug, parsed.data.secret, propia, parsed.data.idempotencyKey);
  }
  return { ok: false, message: "No encontramos tu tarjeta en este celular.", sinTarjeta: true };
}

/**
 * El celular no recuerda la tarjeta: el cliente escribe su número de celular (el de la inscripción) y se
 * suma el sello en ese momento. Solo funciona con la etiqueta del mostrador (su enlace secreto) y con las
 * reglas de siempre: tiempo mínimo entre visitas y límite de intentos.
 * Para proteger los datos: no muestra el nombre ni abre la tarjeta, ni la guarda en este celular.
 */
export async function nfcRecuperarAction(slug: string, secret: string, datos: { celular: string }, idempotencyKey: string): Promise<NfcTapResult> {
  const parsed = recuperarInput.safeParse({ slug, secret, ...datos, idempotencyKey });
  if (!parsed.success) return { ok: false, message: "Escribe tu número de celular." };
  if (!rateLimit(`nfc-recuperar:${await ipCliente()}`, 6, 10 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }
  const celular = normalizePhone(parsed.data.celular);
  if (!/^\+[1-9][0-9]{6,14}$/.test(celular)) return { ok: false, message: "Revisa tu número de celular." };

  const noEncontrada: NfcTapResult = {
    ok: false,
    message: "No encontramos una tarjeta con ese número. Escribe el mismo con el que te inscribiste.",
  };
  const supabase = createAdminClient();
  const { data: negocio } = await supabase.from("businesses").select("id").eq("slug", parsed.data.slug).maybeSingle();
  if (!negocio) return noEncontrada;
  const { data: cliente } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", negocio.id)
    .eq("phone_e164", celular)
    .maybeSingle();
  if (!cliente) return noEncontrada;
  const { data: tarjetas } = await supabase
    .from("loyalty_cards")
    .select("public_token")
    .eq("customer_id", cliente.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const token = tarjetas?.[0]?.public_token as string | undefined;
  if (!token) return noEncontrada;
  return registrarToque(parsed.data.slug, parsed.data.secret, token, parsed.data.idempotencyKey, false);
}

/** La tarjeta se abrió en este celular: se recuerda (o se renueva) para el toque NFC. */
export async function recordarTarjetaAction(token: string): Promise<void> {
  if (!TOKEN.safeParse(token).success) return;
  if (!rateLimit(`recordar:${await ipCliente()}`, 30, 10 * 60_000)) return;
  if (await getPublicCard(token)) await recordarTarjeta(token);
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

// ---------- Panel: lector NFC del mostrador (Smart Tap de Google Wallet) ----------

/**
 * Al abrir «Lector NFC»: dice si Smart Tap está encendido en el servidor y, si lo está,
 * actualiza la clase del comercio en Google para que sus pases respondan al lector.
 */
export async function prepareSmartTapAction(businessId: string): Promise<{ enabled: boolean }> {
  if (!z.uuid().safeParse(businessId).success || !googleWalletConfig()?.smartTap) return { enabled: false };
  scheduleBusinessWalletSync(businessId);
  return { enabled: true };
}

/** Tarjeta leída por el lector que aún no está en la pantalla (p. ej. alguien que se inscribió hoy). RLS limita al comercio del usuario. */
export async function findCardForReaderAction(
  businessId: string,
  token: string,
): Promise<{ id: string; status: string; stamps: number; firstName: string } | null> {
  if (!z.uuid().safeParse(businessId).success || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("loyalty_cards")
    .select("id, status, current_stamps, customers(full_name, first_name)")
    .eq("business_id", businessId)
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  const customer = data.customers as unknown as { full_name?: string; first_name?: string | null } | null;
  const firstName = customer?.first_name?.trim() || customer?.full_name?.split(" ")[0] || "Cliente";
  return { id: data.id, status: data.status, stamps: data.current_stamps, firstName };
}
