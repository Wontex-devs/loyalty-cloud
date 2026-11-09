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
  const isSuper = session.profile?.platformRole === "superadmin";
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

/* ---------- Administradores de la plataforma ---------- */

const superadminInviteSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe el nombre.").max(80, "El nombre es muy largo."),
  email: z.email("Correo no válido"),
});

/**
 * Invita a un superadministrador de la plataforma. Solo lo puede hacer otro superadministrador.
 * Si la persona no tiene cuenta, recibe un correo para crear su propia contraseña; la app nunca fija ni ve contraseñas.
 */
export async function inviteSuperadminAction(input: { fullName: string; email: string }): Promise<ActionResult> {
  const parsed = superadminInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." };

  const session = await getSession();
  if (session?.profile?.platformRole !== "superadmin") return fail({ message: "FORBIDDEN" });

  const admin = createAdminClient();
  const email = parsed.data.email.toLowerCase();
  const { data: existing } = await admin.from("profiles").select("id, platform_role").eq("email", email).maybeSingle();
  if (existing?.platform_role === "superadmin") return { ok: true, message: "Esa persona ya es superadministradora." };

  let profileId = existing?.id as string | undefined;
  if (!profileId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: `${await origin()}/auth/callback?next=/account/password`,
    });
    if (error || !data.user) {
      return { ok: false, message: "No se pudo enviar la invitación. Si el correo no llega, puede haberse alcanzado el límite de envíos de Supabase: espera unos minutos." };
    }
    profileId = data.user.id;
  }

  // La service_role solo se usa aquí, después de comprobar que quien invita es superadministrador.
  const { error: roleError } = await admin.from("profiles").update({ platform_role: "superadmin" }).eq("id", profileId);
  if (roleError) return { ok: false, message: "Se envió la invitación, pero no se pudo dar el rol. Inténtalo de nuevo." };

  const { error: auditError } = await admin.from("audit_logs").insert({
    business_id: null,
    actor_id: session.user.id,
    action: "platform.superadmin_granted",
    entity: "profile",
    entity_id: profileId,
    metadata: { invited: !existing },
  });
  if (auditError) console.error("[admin] no se pudo registrar la auditoría", auditError.message);

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: existing
      ? "Listo: esa persona ya tenía cuenta y ahora es superadministradora."
      : "Invitación enviada. Al abrir el correo y crear su contraseña tendrá acceso de superadministrador.",
  };
}
