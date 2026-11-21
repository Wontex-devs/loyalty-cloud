"use server";

/**
 * Server Actions del toque NFC: el cliente acerca el celular a la etiqueta del mostrador y se registra su visita,
 * y el panel enciende o actualiza la etiqueta. Las reglas viven en Postgres (register_nfc_visit, set_nfc_settings).
 */
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleCardWalletSync } from "@/lib/wallet/sync";
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
/** Ubicación del celular, solo si el comercio exige estar en el local. Se compara en la base y no se guarda. */
const UBICACION = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional();
export type Ubicacion = { lat: number; lng: number };
const coordenadas = (u: unknown) => {
  const p = UBICACION.safeParse(u);
  return { p_lat: p.success && p.data ? p.data.lat : null, p_lng: p.success && p.data ? p.data.lng : null };
};
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
      /** Se sumó escribiendo el celular: no se muestran los sellos (podría ser el número de otra persona). */
      sinDetalle?: true;
    }
  | {
      ok: false;
      message: string;
      /** La tarjeta sí es de este celular (p. ej. ya sumó su sello hace poco): se puede abrir. */
      token?: string;
      /** Este celular no tiene tarjeta guardada de este comercio: hay que confirmar los datos. */
      sinTarjeta?: true;
      /**
       * «pronto»: ya sumó su sello hace poco o ya sumó el de hoy (no es una falla). «etiqueta»: la etiqueta no sirve,
       * reintentar no ayuda. «ubicacion»: el comercio exige estar en el local; hay que pedir la ubicación y reintentar.
       * «lejos»: el celular no está cerca del local.
       */
      motivo?: "pronto" | "etiqueta" | "ubicacion" | "lejos";
    };

const ipCliente = async () => {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
};

/** A la base de datos llega un HMAC de la IP, nunca la IP (igual que en la inscripción). */
const claveDeConexion = (ip: string) =>
  createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local").update(`nfc:${ip}`).digest("base64url").slice(0, 32);

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
async function registrarToque(slug: string, secret: string, cardToken: string, idempotencyKey: string, recordar = true, ubicacion?: Ubicacion): Promise<NfcTapResult> {
  if (!rateLimit(`nfc-card:${cardToken}`, 8, 60 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("register_nfc_visit", {
    p_slug: slug,
    p_secret: secret,
    p_card_token: cardToken,
    p_idempotency_key: idempotencyKey,
    ...coordenadas(ubicacion),
  });
  // Reintento de un toque que ya se registró (se perdió la respuesta): se muestra como hecho, sin sumar otro.
  const repetido = !!error && /DUPLICATE_REQUEST/.test(error.message ?? "");
  if (error && !repetido) {
    const codigo = error.message ?? "";
    if (ERROR_DE_ETIQUETA.test(codigo)) return { ok: false, message: dbErrorMessage(error), motivo: "etiqueta" };
    if (/LOCATION_REQUIRED/.test(codigo)) return { ok: false, message: dbErrorMessage(error), motivo: "ubicacion" };
    if (/TOO_FAR/.test(codigo)) return { ok: false, message: dbErrorMessage(error), motivo: "lejos" };
    const pronto = /TOO_SOON|NFC_DAILY_LIMIT/.test(codigo);
    const message = /TOO_SOON/.test(codigo)
      ? "Ya sumaste un sello hace poco. El siguiente se suma en tu próxima visita."
      : dbErrorMessage(error, "No pudimos registrar tu visita. Inténtalo de nuevo.");
    const motivo = pronto ? ({ motivo: "pronto" } as const) : {};
    if (!recordar) return { ok: false, message, ...motivo };
    await recordarTarjeta(cardToken);
    return { ok: false, message, token: cardToken, ...motivo };
  }

  if (!repetido) {
    const res = data as { card_id: string; reward_id: string | null; birthday_reward_id?: string | null };
    scheduleCardWalletSync(res.card_id, { idempotencyKey, rewardEarned: !!res.reward_id, birthdayReward: !!res.birthday_reward_id }, { service: true });
  }
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
export async function nfcTapAction(slug: string, secret: string, cardToken: string | null, idempotencyKey: string, ubicacion?: Ubicacion): Promise<NfcTapResult> {
  const parsed = tapInput.safeParse({ slug, secret, cardToken, idempotencyKey });
  if (!parsed.success) return { ok: false, message: "Este enlace no es válido. Acerca el celular a la etiqueta de nuevo." };
  // Frenos rápidos en este servidor; el que cuenta es el tiempo mínimo entre visitas en Postgres.
  // Amplio a propósito: los clientes de un mismo local suelen compartir la wifi (la misma IP).
  if (!rateLimit(`nfc-ip:${await ipCliente()}`, 120, 10 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }

  const candidatas = [parsed.data.cardToken, ...(await tarjetasRecordadas())].filter((t, i, l): t is string => !!t && l.indexOf(t) === i);
  for (const t of candidatas) {
    const propia = await tarjetaDelComercio(t, parsed.data.slug);
    if (propia) return registrarToque(parsed.data.slug, parsed.data.secret, propia, parsed.data.idempotencyKey, true, ubicacion);
  }
  return { ok: false, message: "No encontramos tu tarjeta en este celular.", sinTarjeta: true };
}

/**
 * El celular no recuerda la tarjeta: el cliente escribe su número de celular (el de la inscripción) y se
 * suma el sello en ese momento. Todo pasa en Postgres (register_nfc_visit_by_phone): primero se comprueba la
 * etiqueta y después el número, con límite de intentos guardado en la base. Así nadie puede averiguar desde
 * fuera del local si un número es cliente.
 * Para proteger los datos: no muestra el nombre ni los sellos, no abre la tarjeta ni la guarda en este celular.
 */
export async function nfcRecuperarAction(slug: string, secret: string, datos: { celular: string }, idempotencyKey: string, ubicacion?: Ubicacion): Promise<NfcTapResult> {
  const parsed = recuperarInput.safeParse({ slug, secret, ...datos, idempotencyKey });
  if (!parsed.success) return { ok: false, message: "Escribe tu número de celular." };
  const celular = normalizePhone(parsed.data.celular);
  if (!/^\+[1-9][0-9]{6,14}$/.test(celular)) return { ok: false, message: "Revisa tu número de celular." };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("register_nfc_visit_by_phone", {
    p_slug: parsed.data.slug,
    p_secret: parsed.data.secret,
    p_phone_e164: celular,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_client_key: claveDeConexion(await ipCliente()),
    ...coordenadas(ubicacion),
  });
  if (error) {
    const codigo = error.message ?? "";
    if (/RATE_LIMITED/.test(codigo)) return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
    if (/LOCATION_REQUIRED/.test(codigo)) return { ok: false, message: dbErrorMessage(error), motivo: "ubicacion" };
    if (/TOO_FAR/.test(codigo)) return { ok: false, message: dbErrorMessage(error), motivo: "lejos" };
    if (/TOO_SOON/.test(codigo)) return { ok: false, message: "Con este número ya se sumó una visita hace poco." };
    if (/NFC_DAILY_LIMIT/.test(codigo)) return { ok: false, message: "Con este número ya se sumó el sello de hoy. Vuelve mañana por el siguiente." };
    if (/DUPLICATE_REQUEST/.test(codigo)) return { ok: true, businessName: "", stamps: 0, required: 0, rewardName: "", rewardReady: false, sinDetalle: true };
    return { ok: false, message: dbErrorMessage(error, "No pudimos registrar tu visita. Inténtalo de nuevo.") };
  }
  const res = data as { error?: string; card_id?: string; reward_id?: string | null; birthday_reward_id?: string | null };
  if (res.error || !res.card_id) {
    return { ok: false, message: "No encontramos una tarjeta con ese número. Escribe el mismo con el que te inscribiste." };
  }
  scheduleCardWalletSync(res.card_id, { idempotencyKey: parsed.data.idempotencyKey, rewardEarned: !!res.reward_id, birthdayReward: !!res.birthday_reward_id }, { service: true });
  return { ok: true, businessName: "", stamps: 0, required: 0, rewardName: "", rewardReady: false, sinDetalle: true };
}

/** La tarjeta se abrió en este celular: se recuerda (o se renueva) para el toque NFC. */
export async function recordarTarjetaAction(token: string): Promise<void> {
  if (!TOKEN.safeParse(token).success) return;
  if (!rateLimit(`recordar:${await ipCliente()}`, 30, 10 * 60_000)) return;
  if (await getPublicCard(token)) await recordarTarjeta(token);
}

// ---------- Panel: ajustes de la etiqueta ----------

export type NfcSettings = {
  enabled: boolean;
  secret: string;
  minMinutes: number;
  /** Sellos por NFC que una tarjeta puede sumar en un día. */
  maxPerDay: number;
  /** El celular debe estar cerca de una sede para sumar. */
  requireLocation: boolean;
  /** Hay al menos una sede con ubicación guardada (sin ella no se puede exigir). */
  canRequireLocation: boolean;
};
export type NfcSettingsResult = { ok: true; settings: NfcSettings } | { ok: false; message: string };

const toSettings = (d: { enabled: boolean; secret: string; min_minutes: number; max_per_day?: number; require_location?: boolean; can_require_location?: boolean }): NfcSettings => ({
  enabled: d.enabled,
  secret: d.secret,
  minMinutes: d.min_minutes,
  maxPerDay: d.max_per_day ?? 1,
  requireLocation: d.require_location === true,
  canRequireLocation: d.can_require_location === true,
});

export async function getNfcSettingsAction(businessId: string): Promise<NfcSettingsResult> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Establecimiento no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_nfc_settings", { p_business_id: businessId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, settings: toSettings(data as never) };
}

export async function setNfcSettingsAction(
  businessId: string,
  enabled: boolean,
  minMinutes: number,
  rotate = false,
  extra: { maxPerDay?: number; requireLocation?: boolean } = {},
): Promise<NfcSettingsResult> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Establecimiento no válido." };
  if (!Number.isInteger(minMinutes) || minMinutes < 0 || minMinutes > 1440) return { ok: false, message: "Revisa el tiempo mínimo entre toques." };
  if (extra.maxPerDay !== undefined && (!Number.isInteger(extra.maxPerDay) || extra.maxPerDay < 1 || extra.maxPerDay > 20)) {
    return { ok: false, message: "El límite de sellos por día va de 1 a 20." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_nfc_settings", {
    p_business_id: businessId,
    p_enabled: enabled,
    p_min_minutes: minMinutes,
    p_rotate: rotate,
    p_max_per_day: extra.maxPerDay ?? null,
    p_require_location: extra.requireLocation ?? null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, settings: toSettings(data as never) };
}
