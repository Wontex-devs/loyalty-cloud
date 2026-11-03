"use server";

/**
 * Server Actions de fidelización: inscripción, visitas, canjes, correcciones,
 * estadísticas y exportación. La lógica de negocio vive en las funciones de
 * Postgres; aquí solo se valida la entrada y se traducen los errores.
 */
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinSchema, normalizePhone, type JoinInput } from "@/lib/domain/schemas";
import { customersCsv } from "@/lib/domain/csv";
import { statsFromRow, type BusinessStats } from "@/lib/domain/stats";
import { promotionSchema } from "@/lib/domain/schemas";
import type { Promotion, WalletSettings } from "@/lib/domain/types";
import { dbErrorMessage } from "./errors";
import { fetchAll } from "./fetch-all";
import { toCard, toCustomer } from "./mappers";
import { scheduleCardWalletSync } from "@/lib/wallet/sync";
import { deliverNotices } from "@/lib/wallet/notify";
import { rateLimit } from "./rate-limit";

export type JoinActionResult = { ok: true; token: string; existing: boolean } | { ok: false; message: string };

/** Comprueba el desafío anti-bots de Cloudflare Turnstile. Sin TURNSTILE_SECRET_KEY no se exige. */
async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch {
    return false;
  }
}

export async function joinProgramAction(slug: string, input: JoinInput, captchaToken?: string): Promise<JoinActionResult> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const phone = normalizePhone(parsed.data.phone);
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) return { ok: false, message: "Teléfono no válido." };

  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // Freno rápido en este servidor; el límite que cuenta está en Postgres (join_program_limited).
  if (!rateLimit(`join:${ip}`, 10, 10 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }
  if (!(await verifyTurnstile(captchaToken, ip))) {
    return { ok: false, message: "No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo." };
  }

  // join_program ya no es accesible con la clave pública: solo con la service_role, desde aquí.
  // A la base de datos llega un HMAC de la IP, nunca la IP.
  const clientKey = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local").update(ip).digest("base64url").slice(0, 32);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("join_program_limited", {
    p_client_key: clientKey,
    p_slug: slug,
    p_full_name: parsed.data.fullName,
    p_phone_e164: phone,
    p_email: parsed.data.email || null,
    p_accept_terms: parsed.data.acceptTerms,
    p_marketing_consent: parsed.data.marketingConsent,
    p_birth_month: parsed.data.birthMonth ?? null,
    p_birth_day: parsed.data.birthDay ?? null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error, "No pudimos crear tu tarjeta. Inténtalo de nuevo.") };

  const row = (Array.isArray(data) ? data[0] : data) as { public_token: string; existing: boolean } | undefined;
  if (!row?.public_token) return { ok: false, message: "No pudimos crear tu tarjeta. Inténtalo de nuevo." };
  revalidatePath("/business", "layout");
  return { ok: true, token: row.public_token, existing: row.existing };
}

export type VisitActionResult =
  | { ok: true; data: { reward?: string; currentStamps: number; bonusStamps: number; birthdayReward: string | null } }
  | { ok: false; message: string };

const visitInput = z.object({ cardId: z.uuid(), idempotencyKey: z.string().min(8).max(100) });

export async function registerVisitAction(cardId: string, idempotencyKey: string, locationId?: string): Promise<VisitActionResult> {
  const parsed = visitInput.safeParse({ cardId, idempotencyKey });
  if (locationId && !z.uuid().safeParse(locationId).success) return { ok: false, message: "Sede no válida." };
  if (!parsed.success) return { ok: false, message: "Tarjeta no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_visit", {
    p_card_id: parsed.data.cardId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_location_id: locationId ?? null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };

  const res = data as { reward_id: string | null; current_stamps: number; bonus_stamps?: number; birthday_reward_id?: string | null };
  revalidatePath("/business", "layout");
  scheduleCardWalletSync(parsed.data.cardId, {
    idempotencyKey: parsed.data.idempotencyKey,
    rewardEarned: !!res.reward_id,
    birthdayReward: !!res.birthday_reward_id,
  });
  return {
    ok: true,
    data: {
      reward: res.reward_id ?? undefined,
      currentStamps: res.current_stamps,
      bonusStamps: res.bonus_stamps ?? 0,
      birthdayReward: res.birthday_reward_id ? "Regalo de cumpleaños" : null,
    },
  };
}

// ---------- Etapa 4: canjes, correcciones, bloqueo, estadísticas y exportación ----------

export type OpActionResult = { ok: true } | { ok: false; message: string };

export async function redeemRewardAction(rewardId: string): Promise<OpActionResult> {
  if (!z.uuid().safeParse(rewardId).success) return { ok: false, message: "Recompensa no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const { data: rw } = await supabase.from("rewards").select("card_id").eq("id", rewardId).maybeSingle();
  if (rw?.card_id) scheduleCardWalletSync(rw.card_id);
  revalidatePath("/business", "layout");
  return { ok: true };
}

const reverseInput = z.object({ visitId: z.uuid(), reason: z.string().trim().min(5, "Indica el motivo de la corrección.").max(200) });

export async function reverseVisitAction(visitId: string, reason: string): Promise<OpActionResult> {
  const parsed = reverseInput.safeParse({ visitId, reason });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_visit", { p_visit_id: parsed.data.visitId, p_reason: parsed.data.reason });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const { data: v } = await supabase.from("visits").select("card_id").eq("id", parsed.data.visitId).maybeSingle();
  if (v?.card_id) scheduleCardWalletSync(v.card_id);
  revalidatePath("/business", "layout");
  return { ok: true };
}

export async function setCardBlockedAction(cardId: string, blocked: boolean): Promise<OpActionResult> {
  if (!z.uuid().safeParse(cardId).success) return { ok: false, message: "Tarjeta no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_card_blocked", { p_card_id: cardId, p_blocked: blocked === true });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  scheduleCardWalletSync(cardId);
  revalidatePath("/business", "layout");
  return { ok: true };
}

export async function getBusinessStatsAction(
  businessId: string,
  days: number,
): Promise<{ ok: true; stats: BusinessStats } | { ok: false; message: string }> {
  const parsed = z.object({ businessId: z.uuid(), days: z.number().int().min(1).max(365) }).safeParse({ businessId, days });
  if (!parsed.success) return { ok: false, message: "Periodo no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("business_stats", { p_business_id: businessId, p_days: days });
  if (error || !data) return { ok: false, message: dbErrorMessage(error, "No se pudieron cargar las estadísticas.") };
  return { ok: true, stats: statsFromRow(data) };
}

/** CSV de clientes. Solo el propietario (permiso customers.export), comprobado aquí y no solo en la UI. */
export async function exportCustomersAction(businessId: string): Promise<{ ok: true; csv: string } | { ok: false; message: string }> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Comercio no válido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const { data: m } = await supabase
    .from("business_memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("profile_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (m?.role !== "owner") return { ok: false, message: "Solo el propietario puede exportar clientes." };

  const [customers, cards] = await Promise.all([
    fetchAll((from, to) => supabase.from("customers").select("*").eq("business_id", businessId).order("created_at").range(from, to)),
    fetchAll((from, to) => supabase.from("loyalty_cards").select("*").eq("business_id", businessId).order("created_at").range(from, to)),
  ]);
  await supabase.rpc("log_customers_export", { p_business_id: businessId, p_count: customers.length });
  return { ok: true, csv: customersCsv(customers.map(toCustomer), cards.map(toCard)) };
}

// ---------- Etapa 7: promociones y contactos por WhatsApp ----------

type PromotionInput = Pick<Promotion, "name" | "bonusStamps" | "startsOn" | "endsOn" | "weekdays" | "active">;

/** Crea o actualiza una promoción. RLS solo lo permite a propietario y administrador. */
export async function savePromotionAction(businessId: string, input: PromotionInput, id?: string): Promise<OpActionResult> {
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  if (!z.uuid().safeParse(businessId).success || (id && !z.uuid().safeParse(id).success)) return { ok: false, message: "Datos no válidos." };
  const d = parsed.data;
  const row = {
    name: d.name,
    bonus_stamps: d.bonusStamps,
    starts_on: d.startsOn,
    ends_on: d.endsOn,
    weekdays: [...new Set(d.weekdays)].sort(),
    active: d.active,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("promotions").update(row).eq("id", id).eq("business_id", businessId).select("id")
    : await supabase.from("promotions").insert({ ...row, business_id: businessId }).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error, "No se pudo guardar la promoción.") };
  if (!data?.length) return { ok: false, message: dbErrorMessage({ message: "FORBIDDEN" }) };
  revalidatePath("/business", "layout");
  return { ok: true };
}

/** Deja constancia de un mensaje de WhatsApp enviado a mano (solo clientas con consentimiento). */
export async function logContactAction(customerId: string, segment: string): Promise<OpActionResult> {
  if (!z.uuid().safeParse(customerId).success) return { ok: false, message: "Cliente no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_customer_contact", { p_customer_id: customerId, p_segment: segment.slice(0, 40) });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true };
}

// ---------- Etapa 12: avisos en la billetera ----------

const walletSettingsInput = z.object({
  stamp: z.boolean(),
  near: z.boolean(),
  reward: z.boolean(),
  birthday: z.boolean(),
  winback: z.boolean(),
  winbackDays: z.number().int().min(14, "Mínimo 14 días.").max(180, "Máximo 180 días."),
});

export async function updateWalletSettingsAction(businessId: string, settings: WalletSettings): Promise<OpActionResult> {
  const parsed = walletSettingsInput.safeParse(settings);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los ajustes." };
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_wallet_settings", { p_business_id: businessId, p_settings: parsed.data });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/business", "layout");
  return { ok: true };
}

export type WalletCampaignResult =
  | { ok: true; queued: number; skipped: number; sent: number; notSaved: number; failed: number }
  | { ok: false; message: string };

const campaignInput = z.object({
  businessId: z.uuid(),
  customerIds: z.array(z.uuid()).min(1, "No hay clientes en este grupo.").max(2000),
  title: z.string().trim().min(1, "Escribe el título del aviso.").max(40, "El título admite hasta 40 caracteres."),
  body: z.string().trim().min(1, "Escribe el mensaje.").max(240, "El mensaje admite hasta 240 caracteres."),
});

/** Envía un aviso a la billetera de todo un grupo. La base de datos filtra consentimiento y frecuencia. */
export async function sendWalletCampaignAction(
  businessId: string,
  customerIds: string[],
  title: string,
  body: string,
): Promise<WalletCampaignResult> {
  const parsed = campaignInput.safeParse({ businessId, customerIds, title, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el aviso." };
  if (!rateLimit(`wallet-campaign:${parsed.data.businessId}`, 10, 60 * 60_000)) {
    return { ok: false, message: "Enviaste muchas campañas seguidas. Espera un rato e inténtalo de nuevo." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("queue_wallet_campaign", {
    p_business_id: parsed.data.businessId,
    p_customer_ids: parsed.data.customerIds,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const rows = (data ?? []) as { notification_id: string; public_token: string; title: string; body: string }[];
  const counts = await deliverNotices(rows.map((r) => ({ id: r.notification_id, token: r.public_token, title: r.title, body: r.body })));
  revalidatePath("/business", "layout");
  return { ok: true, queued: rows.length, skipped: parsed.data.customerIds.length - rows.length, ...counts };
}

// ---------- Etapa 8: sedes y planes ----------

const locationInput = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la sede").max(60),
  address: z.string().trim().max(200).optional(),
  active: z.boolean(),
});

/** Crea o actualiza una sede. RLS: propietario y administrador; el plan limita las activas. */
export async function saveLocationAction(
  businessId: string,
  input: { name: string; address?: string; active: boolean },
  id?: string,
): Promise<OpActionResult> {
  const parsed = locationInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  if (!z.uuid().safeParse(businessId).success || (id && !z.uuid().safeParse(id).success)) return { ok: false, message: "Datos no válidos." };
  const row = { name: parsed.data.name, address: parsed.data.address || null, active: parsed.data.active };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("locations").update(row).eq("id", id).eq("business_id", businessId).select("id")
    : await supabase.from("locations").insert({ ...row, business_id: businessId }).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error, "No se pudo guardar la sede.") };
  if (!data?.length) return { ok: false, message: dbErrorMessage({ message: "FORBIDDEN" }) };
  revalidatePath("/business", "layout");
  return { ok: true };
}

/** Cambia el plan de un comercio (solo superadmin; lo comprueba la RPC). */
export async function setBusinessPlanAction(businessId: string, planId: string): Promise<OpActionResult> {
  if (!z.uuid().safeParse(businessId).success || !/^[a-z0-9_]{2,40}$/.test(planId)) return { ok: false, message: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_plan", { p_business_id: businessId, p_plan_id: planId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/business", "layout");
  return { ok: true };
}

// ---------- Etapa 11: derechos de la clienta ----------

/** Elimina los datos personales de una clienta (solo el propietario). Las visitas quedan anónimas. */
export async function anonymizeCustomerAction(customerId: string): Promise<OpActionResult> {
  if (!z.uuid().safeParse(customerId).success) return { ok: false, message: "Clienta no válida." };
  const supabase = await createClient();
  const { data: card } = await supabase.from("loyalty_cards").select("id").eq("customer_id", customerId).maybeSingle();
  const { error } = await supabase.rpc("anonymize_customer", { p_customer_id: customerId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (card?.id) scheduleCardWalletSync(card.id);
  revalidatePath("/business", "layout");
  return { ok: true };
}

export async function revokeMarketingConsentAction(customerId: string): Promise<OpActionResult> {
  if (!z.uuid().safeParse(customerId).success) return { ok: false, message: "Clienta no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_marketing_consent", { p_customer_id: customerId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/business", "layout");
  return { ok: true };
}

/** Baja de mensajes desde la tarjeta pública: el token de la tarjeta es la credencial. */
export async function unsubscribeMarketingAction(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsubscribe_marketing", { p_token: token });
  if (error) return false;
  revalidatePath(`/card/${token}`);
  return data === true;
}
