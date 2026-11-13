"use server";

/**
 * Server Actions (Etapa 2). Validan con Zod y ejecutan con la sesión del usuario,
 * de modo que RLS y las funciones RPC aplican los permisos. La service_role solo
 * se usa para invitar usuarios de Auth, después de verificar el rol del que invita.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandingSchema, businessSchema, businessSettingsSchema, programSchema, staffInviteSchema, type BusinessSettingsInput } from "@/lib/domain/schemas";
import { getSession, homePathFor } from "./queries";
import { esSuperadmin } from "@/lib/domain/acceso";
import { dbErrorMessage } from "./errors";
import { scheduleBusinessWalletSync } from "@/lib/wallet/sync";
import type { BusinessBranding, BusinessMembership, BusinessStatus, LoyaltyProgram } from "@/lib/domain/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

function fail(error: { message?: string } | null | undefined, fallback?: string): ActionResult {
  return { ok: false, message: dbErrorMessage(error, fallback) };
}

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_APP_URL ?? h.get("origin") ?? `https://${h.get("host")}`;
}

/* ---------- Autenticación ---------- */

export async function signInWithPassword(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.email(), password: z.string().min(6) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Revisa el correo y la contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mensaje genérico: no revela si el correo existe.
  if (error) return { ok: false, message: "Correo o contraseña incorrectos." };
  await registrarInicio(supabase, "password");

  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/start");
}

export async function sendMagicLink(_: unknown, form: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { ok: false, message: "Correo no válido." };
  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${await origin()}/auth/callback?next=/start` },
  });
  // Misma respuesta exista o no la cuenta.
  return { ok: true, message: "Si el correo tiene acceso, recibirás un enlace para entrar." };
}

export async function sendPasswordReset(_: unknown, form: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { ok: false, message: "Correo no válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${await origin()}/auth/callback?next=/account/password` });
  // Misma respuesta exista o no la cuenta.
  return { ok: true, message: "Si el correo tiene acceso, recibirás un enlace para cambiar tu contraseña." };
}

/** Deja constancia del inicio de sesión (fecha y método). Si falla, no impide entrar. */
async function registrarInicio(supabase: Awaited<ReturnType<typeof createClient>>, metodo: "password" | "magic_link" | "invite" | "recovery") {
  const { error } = await supabase.rpc("record_login", { p_method: metodo });
  if (error) console.error("[auth] no se pudo registrar el inicio de sesión", error.message);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function goHome() {
  const session = await getSession();
  redirect(session ? homePathFor(session) : "/login");
}

/* ---------- Comercio ---------- */

const programPatch = programSchema.partial().extend({ active: z.boolean().optional() });

export async function updateProgramAction(programId: string, patch: Partial<LoyaltyProgram>): Promise<ActionResult> {
  const parsed = programPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const d = parsed.data;
  const row: Record<string, unknown> = {};
  if (d.name !== undefined) row.name = d.name;
  if (d.description !== undefined) row.description = d.description;
  if (d.stampsRequired !== undefined) row.stamps_required = d.stampsRequired;
  if (d.rewardName !== undefined) row.reward_name = d.rewardName;
  if (d.rewardDescription !== undefined) row.reward_description = d.rewardDescription;
  if (d.minMinutesBetweenVisits !== undefined) row.min_minutes_between_visits = d.minMinutesBetweenVisits;
  if (d.rewardExpiryDays !== undefined) row.reward_expiry_days = d.rewardExpiryDays || null;
  if (d.welcomeStamps !== undefined) row.welcome_stamps = d.welcomeStamps;
  if (d.birthdayReward !== undefined) row.birthday_reward = d.birthdayReward || null;
  if (d.terms !== undefined) row.terms = d.terms;
  if (d.active !== undefined) row.active = d.active;

  const supabase = await createClient();
  const { data, error } = await supabase.from("loyalty_programs").update(row).eq("id", programId).select("id, business_id");
  if (error) return fail(error);
  if (!data?.length) return fail({ message: "FORBIDDEN" });
  scheduleBusinessWalletSync(data[0].business_id);
  revalidatePath("/business", "layout");
  return { ok: true };
}

export async function updateBrandingAction(businessId: string, patch: Partial<BusinessBranding>): Promise<ActionResult> {
  const parsed = brandingSchema.partial().safeParse(patch);
  if (!parsed.success) return { ok: false, message: "La personalización de la marca no es válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_business_profile", {
    p_business_id: businessId,
    p_name: null,
    p_category: null,
    p_city: null,
    p_timezone: null,
    p_branding: parsed.data,
  });
  if (error) return fail(error);
  scheduleBusinessWalletSync(businessId);
  revalidatePath("/business", "layout");
  return { ok: true };
}

export async function updateBusinessSettingsAction(businessId: string, input: BusinessSettingsInput): Promise<ActionResult> {
  const parsed = businessSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Comercio no válido." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_business_settings", {
    p_business_id: businessId,
    p_name: d.name,
    p_category: d.category,
    p_city: d.city,
    p_timezone: d.timezone,
    p_legal_name: d.legalName || null,
    p_tax_id: d.taxId || null,
    p_contact_email: d.contactEmail || null,
    p_contact_phone: d.contactPhone || null,
    p_address: d.address || null,
  });
  if (error) return fail(error);
  scheduleBusinessWalletSync(businessId);
  revalidatePath("/business", "layout");
  revalidatePath("/join", "layout");
  return { ok: true, message: "Configuración guardada." };
}

/** Invita a un empleado: crea (o reutiliza) su usuario de Auth y añade la membresía bajo RLS. */
export async function inviteStaffAction(
  businessId: string,
  input: { fullName: string; email: string; role: "admin" | "staff"; canRedeem: boolean },
): Promise<ActionResult> {
  return inviteMember(businessId, input);
}

// No exportada: no es invocable desde el cliente. El rol "owner" solo lo usa createBusinessAction.
async function inviteMember(
  businessId: string,
  input: { fullName: string; email: string; role: "admin" | "staff" | "owner"; canRedeem: boolean },
  opts: { allowOwner?: boolean } = {},
): Promise<ActionResult> {
  const parsed = (opts.allowOwner ? staffInviteSchema.extend({ role: z.enum(["owner", "admin", "staff"]) }) : staffInviteSchema).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." };

  const session = await getSession();
  if (!session) return fail({ message: "FORBIDDEN" });
  const isSuper = esSuperadmin(session.profile);
  const mine = session.memberships.find((m) => m.businessId === businessId);
  if (!isSuper && !(mine && (mine.role === "owner" || mine.role === "admin"))) return fail({ message: "FORBIDDEN" });

  const admin = createAdminClient();
  const email = parsed.data.email.toLowerCase();
  let profileId: string | undefined;
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) profileId = existing.id;
  else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: `${await origin()}/auth/callback?next=/account/password`,
    });
    if (error || !data.user) return { ok: false, message: "No se pudo enviar la invitación." };
    profileId = data.user.id;
  }

  // La inserción va con la sesión del usuario: RLS decide si puede hacerlo.
  const supabase = await createClient();
  const { error } = await supabase.from("business_memberships").insert({
    business_id: businessId,
    profile_id: profileId,
    role: parsed.data.role,
    can_redeem: parsed.data.role !== "staff" || parsed.data.canRedeem,
  });
  if (error) return fail(error, error.code === "23505" ? "Esa persona ya pertenece a este comercio." : undefined);
  revalidatePath("/business", "layout");
  return { ok: true, message: "Invitación enviada." };
}

export async function updateMembershipAction(membershipId: string, patch: Partial<BusinessMembership>): Promise<ActionResult> {
  const row: Record<string, unknown> = {};
  if (typeof patch.active === "boolean") row.active = patch.active;
  if (typeof patch.canRedeem === "boolean") row.can_redeem = patch.canRedeem;
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_memberships").update(row).eq("id", membershipId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ message: "FORBIDDEN" });
  revalidatePath("/business", "layout");
  return { ok: true };
}

/* ---------- Plataforma (superadmin; las RPC vuelven a comprobarlo) ---------- */

export async function setBusinessStatusAction(businessId: string, status: BusinessStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_status", { p_business_id: businessId, p_status: status, p_reason: null });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function createBusinessAction(input: {
  name: string;
  slug: string;
  category: string;
  city: string;
  planId: string;
  ownerName?: string;
  ownerEmail?: string;
}): Promise<ActionResult & { id?: string }> {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_category: parsed.data.category,
    p_city: parsed.data.city,
    p_plan_id: parsed.data.planId,
  });
  if (error) return fail(error);

  if (input.ownerEmail) {
    const invite = await inviteMember(
      id as string,
      { fullName: input.ownerName || input.ownerEmail, email: input.ownerEmail, role: "owner", canRedeem: true },
      { allowOwner: true },
    );
    if (!invite.ok) return { ok: true, id: id as string, message: `Comercio creado, pero la invitación falló: ${invite.message}` };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, id: id as string, message: "Comercio creado." };
}

/* ---------- Cuentas del panel (el resto de la gestión de usuarios está en admin-actions.ts) ---------- */

/**
 * Elimina la cuenta de una persona del panel (dueño, empleado o administrador). Solo un superadministrador.
 * - No se puede eliminar a uno mismo ni al último superadministrador.
 * - Si es la única propietaria de algún comercio, primero hay que eliminar ese comercio o darle otro propietario.
 * - Las visitas y canjes que registró siguen en el historial, sin su nombre.
 */
export async function deleteUserAction(profileId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(profileId).success) return { ok: false, message: "Datos no válidos." };

  const session = await getSession();
  if (!session || !esSuperadmin(session.profile)) return fail({ message: "FORBIDDEN" });
  if (profileId === session.user.id) return { ok: false, message: "No puedes eliminar tu propia cuenta." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, platform_role").eq("id", profileId).maybeSingle();
  if (!target) return { ok: true, message: "Esa cuenta ya no existe." };
  if (target.platform_role === "superadmin") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("platform_role", "superadmin").is("suspended_at", null);
    if ((count ?? 0) <= 1) return { ok: false, message: "Debe quedar al menos un administrador de la plataforma." };
  }

  // ¿Es la única propietaria de algún comercio?
  const { data: propios } = await admin.from("business_memberships").select("business_id").eq("profile_id", profileId).eq("role", "owner");
  const ids = (propios ?? []).map((m) => m.business_id as string);
  if (ids.length) {
    const { data: otros } = await admin.from("business_memberships").select("business_id").in("business_id", ids).eq("role", "owner").neq("profile_id", profileId);
    const conOtroDueno = new Set((otros ?? []).map((m) => m.business_id as string));
    const solos = ids.filter((id) => !conOtroDueno.has(id));
    if (solos.length) {
      const { data: negocios } = await admin.from("businesses").select("name").in("id", solos);
      const nombres = (negocios ?? []).map((n) => n.name).join(", ");
      return { ok: false, message: `Es la única propietaria de: ${nombres}. Elimina primero ese comercio o asígnale otro propietario.` };
    }
  }

  const { error: auditError } = await admin.from("audit_logs").insert({
    business_id: null,
    actor_id: session.user.id,
    action: "platform.user_deleted",
    entity: "profile",
    entity_id: profileId,
    metadata: { platform_role: target.platform_role },
  });
  if (auditError) console.error("[admin] no se pudo registrar la auditoría", auditError.message);

  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { ok: false, message: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Cuenta eliminada." };
}

/**
 * Elimina un comercio con todos sus datos: clientes, tarjetas, visitas, canjes, sedes, equipo y logo.
 * Solo un superadministrador, escribiendo el identificador del comercio para confirmar. No se puede deshacer.
 */
export async function deleteBusinessAction(businessId: string, confirmSlug: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Datos no válidos." };

  const session = await getSession();
  if (!session || !esSuperadmin(session.profile)) return fail({ message: "FORBIDDEN" });

  // La función de la base comprueba de nuevo el rol y la confirmación, y deja la auditoría.
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_business", { p_business_id: businessId, p_confirm_slug: confirmSlug.trim() });
  if (error) return fail(error);

  // El logo vive en Storage (brand-assets/<id>/…), fuera de la base: se borra aparte.
  try {
    const admin = createAdminClient();
    const bucket = admin.storage.from("brand-assets");
    const { data: archivos } = await bucket.list(businessId);
    if (archivos?.length) await bucket.remove(archivos.map((f) => `${businessId}/${f.name}`));
  } catch (e) {
    console.error("[admin] no se pudo borrar el logo del comercio eliminado", e);
  }

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Comercio eliminado." };
}
