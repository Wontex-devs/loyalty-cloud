"use server";

/**
 * Acciones del panel de la plataforma sobre usuarios.
 * Cada una comprueba aquí que quien la usa es superadministrador activo, y la base de datos lo vuelve a comprobar
 * (funciones admin_* de la migración 0019), además de dejar el registro en la auditoría en la misma transacción.
 * La service_role solo se usa para lo que vive en Supabase Auth (invitar, bloquear el inicio de sesión), después de esa comprobación.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperadmin, estadoCuenta, ESTADOS_CUENTA, nombreAccion, ROLES_PLATAFORMA, GRUPOS_AUDITORIA, type GrupoAuditoria } from "@/lib/domain/acceso";
import { toCsv } from "@/lib/domain/csv";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { getSession } from "./queries";
import { dbErrorMessage } from "./errors";
import { cargarUsuarios, consultarAuditoria } from "./admin-queries";

export type ResultadoAdmin = { ok: true; message?: string } | { ok: false; message: string };

const NO_PERMITIDO: ResultadoAdmin = { ok: false, message: "No tienes permiso para realizar esta acción." };
const id = z.uuid();

async function exigirSuperadmin() {
  const session = await getSession();
  return session && esSuperadmin(session.profile) ? session : null;
}

async function origen() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_APP_URL ?? h.get("origin") ?? `https://${h.get("host")}`;
}

function refrescar(profileId?: string) {
  revalidatePath("/admin", "layout");
  if (profileId) revalidatePath(`/admin/users/${profileId}`);
}

/* ---------- Rol de plataforma ---------- */

export async function cambiarRolPlataformaAction(profileId: string, rol: "superadmin" | "support" | "user"): Promise<ResultadoAdmin> {
  if (!id.safeParse(profileId).success || !["superadmin", "support", "user"].includes(rol)) return { ok: false, message: "Datos no válidos." };
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_platform_role", { p_profile_id: profileId, p_role: rol });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refrescar(profileId);
  return { ok: true, message: `Listo: ahora su rol es ${ROLES_PLATAFORMA[rol].nombre}.` };
}

/* ---------- Suspender y reactivar ---------- */

const motivoSchema = z.string().trim().max(300, "El motivo puede tener hasta 300 caracteres.");

export async function suspenderUsuarioAction(profileId: string, motivo: string): Promise<ResultadoAdmin> {
  const m = motivoSchema.safeParse(motivo ?? "");
  if (!id.safeParse(profileId).success || !m.success) return { ok: false, message: m.success ? "Datos no válidos." : m.error.issues[0].message };
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;

  // 1) Base de datos: corta el acceso a los datos de inmediato y deja la auditoría.
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_suspension", { p_profile_id: profileId, p_suspend: true, p_reason: m.data || null });
  if (error) return { ok: false, message: dbErrorMessage(error) };

  // 2) Supabase Auth: impide volver a iniciar sesión y renovar la sesión abierta.
  const { error: errorAuth } = await createAdminClient().auth.admin.updateUserById(profileId, { ban_duration: "876000h" });
  refrescar(profileId);
  if (errorAuth) {
    console.error("[admin] no se pudo bloquear el inicio de sesión", errorAuth.message);
    return { ok: true, message: "Cuenta suspendida: ya no ve ningún dato. No se pudo bloquear su inicio de sesión en Supabase; vuelve a intentarlo más tarde." };
  }
  return { ok: true, message: "Cuenta suspendida. Ya no puede entrar ni ver datos." };
}

export async function reactivarUsuarioAction(profileId: string): Promise<ResultadoAdmin> {
  if (!id.safeParse(profileId).success) return { ok: false, message: "Datos no válidos." };
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_suspension", { p_profile_id: profileId, p_suspend: false, p_reason: null });
  if (error) return { ok: false, message: dbErrorMessage(error) };

  const { error: errorAuth } = await createAdminClient().auth.admin.updateUserById(profileId, { ban_duration: "none" });
  refrescar(profileId);
  if (errorAuth) {
    console.error("[admin] no se pudo desbloquear el inicio de sesión", errorAuth.message);
    return { ok: true, message: "Cuenta reactivada en la base de datos, pero no se pudo desbloquear su inicio de sesión. Vuelve a intentarlo." };
  }
  return { ok: true, message: "Cuenta reactivada. Ya puede volver a entrar." };
}

/* ---------- Editar datos ---------- */

export async function editarUsuarioAction(profileId: string, nombre: string): Promise<ResultadoAdmin> {
  const n = z.string().trim().min(2, "Escribe al menos 2 letras.").max(80, "El nombre es muy largo.").safeParse(nombre);
  if (!id.safeParse(profileId).success || !n.success) return { ok: false, message: n.success ? "Datos no válidos." : n.error.issues[0].message };
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", { p_profile_id: profileId, p_full_name: n.data });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refrescar(profileId);
  return { ok: true, message: "Nombre actualizado." };
}

/* ---------- Contraseña: solo por enlace al correo de la persona ---------- */

/**
 * Envía al correo de la persona un enlace para crear una contraseña nueva. Nadie del panel ve ni escribe contraseñas.
 * Si la invitación seguía pendiente, el mismo enlace le sirve para entrar por primera vez.
 */
export async function enviarEnlaceContrasenaAction(profileId: string): Promise<ResultadoAdmin> {
  if (!id.safeParse(profileId).success) return { ok: false, message: "Datos no válidos." };
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profiles").select("email, suspended_at").eq("id", profileId).maybeSingle();
  if (!perfil) return { ok: false, message: "No se encontró esa cuenta." };
  if (perfil.suspended_at) return { ok: false, message: "La cuenta está suspendida. Reactívala antes de enviarle un enlace." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(perfil.email as string, { redirectTo: `${await origen()}/auth/callback?next=/account/password` });
  if (error) {
    const limite = /rate|seconds|too many/i.test(error.message);
    return { ok: false, message: limite ? "Ya se envió un enlace hace poco. Espera un minuto e inténtalo de nuevo." : "No se pudo enviar el enlace. Inténtalo de nuevo." };
  }
  await supabase.rpc("admin_record_action", { p_action: "platform.password_reset_sent", p_entity_id: profileId, p_metadata: {} });
  refrescar(profileId);
  return { ok: true, message: `Enviamos a ${perfil.email} un enlace para crear su contraseña. Vence en una hora.` };
}

/* ---------- Invitar ---------- */

const invitacionSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("plataforma"),
    fullName: z.string().trim().min(2, "Escribe el nombre.").max(80, "El nombre es muy largo."),
    email: z.email("Correo no válido."),
    rol: z.enum(["superadmin", "support"]),
  }),
  z.object({
    tipo: z.literal("comercio"),
    fullName: z.string().trim().min(2, "Escribe el nombre.").max(80, "El nombre es muy largo."),
    email: z.email("Correo no válido."),
    businessId: z.uuid("Elige un comercio."),
    rol: z.enum(["owner", "admin", "staff"]),
    canRedeem: z.boolean(),
  }),
]);
export type InvitacionInput = z.input<typeof invitacionSchema>;

export async function invitarUsuarioAction(input: InvitacionInput): Promise<ResultadoAdmin> {
  const parsed = invitacionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const session = await exigirSuperadmin();
  if (!session) return NO_PERMITIDO;
  const d = parsed.data;
  const email = d.email.toLowerCase();
  if (email === session.user.email?.toLowerCase()) return { ok: false, message: "Ese es tu propio correo." };

  const admin = createAdminClient();
  const { data: existente } = await admin.from("profiles").select("id, suspended_at").eq("email", email).maybeSingle();
  if (existente?.suspended_at) return { ok: false, message: "Esa cuenta está suspendida. Reactívala antes de darle acceso." };

  let profileId = existente?.id as string | undefined;
  if (!profileId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: d.fullName },
      redirectTo: `${await origen()}/auth/callback?next=/account/password`,
    });
    if (error || !data.user) {
      return { ok: false, message: "No se pudo enviar la invitación. Si el correo no llega, puede haberse alcanzado el límite de envíos de Supabase: espera unos minutos." };
    }
    profileId = data.user.id;
  }

  // El permiso lo da la base de datos con la sesión de quien invita (comprueba de nuevo que sea superadministrador).
  const supabase = await createClient();
  if (d.tipo === "plataforma") {
    const { error } = await supabase.rpc("admin_set_platform_role", { p_profile_id: profileId, p_role: d.rol });
    if (error) return { ok: false, message: dbErrorMessage(error, "Se envió la invitación, pero no se pudo dar el rol. Inténtalo de nuevo.") };
  } else {
    const { error } = await supabase.from("business_memberships").insert({
      business_id: d.businessId,
      profile_id: profileId,
      role: d.rol,
      can_redeem: d.rol !== "staff" || d.canRedeem,
    });
    if (error) {
      const duplicado = error.code === "23505";
      const yaHayDueno = duplicado && /one_owner/.test(error.message);
      return {
        ok: false,
        message: yaHayDueno ? "Ese comercio ya tiene propietario." : duplicado ? "Esa persona ya pertenece a ese comercio." : dbErrorMessage(error),
      };
    }
  }

  const { error: errorAuditoria } = await admin.from("audit_logs").insert({
    business_id: null,
    actor_id: session.user.id,
    action: "platform.user_invited",
    entity: "profile",
    entity_id: profileId,
    metadata: d.tipo === "plataforma" ? { tipo: d.tipo, rol: d.rol, cuenta_nueva: !existente } : { tipo: d.tipo, rol: d.rol, business_id: d.businessId, cuenta_nueva: !existente },
  });
  if (errorAuditoria) console.error("[admin] no se pudo registrar la auditoría", errorAuditoria.message);

  refrescar(profileId);
  return {
    ok: true,
    message: existente
      ? "Listo: esa persona ya tenía cuenta y ahora tiene el nuevo acceso."
      : "Invitación enviada. Al abrir el correo y crear su contraseña tendrá acceso.",
  };
}

/* ---------- Acceso a un comercio ---------- */

export async function cambiarAccesoComercioAction(membershipId: string, cambio: { active?: boolean; role?: "admin" | "staff"; canRedeem?: boolean }): Promise<ResultadoAdmin> {
  if (!id.safeParse(membershipId).success) return { ok: false, message: "Datos no válidos." };
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;
  const fila: Record<string, unknown> = {};
  if (typeof cambio.active === "boolean") fila.active = cambio.active;
  if (cambio.role === "admin" || cambio.role === "staff") fila.role = cambio.role;
  if (typeof cambio.canRedeem === "boolean") fila.can_redeem = cambio.canRedeem;
  if (!Object.keys(fila).length) return { ok: false, message: "No hay cambios." };

  const supabase = await createClient();
  // El propietario no se cambia desde aquí: un comercio no puede quedarse sin dueño.
  const { data, error } = await supabase.from("business_memberships").update(fila).eq("id", membershipId).neq("role", "owner").select("profile_id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "El acceso del propietario no se cambia desde aquí." };
  refrescar(data[0].profile_id as string);
  revalidatePath("/business", "layout");
  return { ok: true, message: "Acceso actualizado." };
}

/* ---------- Exportaciones (quedan en la auditoría) ---------- */

export async function exportarUsuariosAction(): Promise<ResultadoAdmin & { csv?: string }> {
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;
  const { usuarios, aviso } = await cargarUsuarios();
  if (aviso) return { ok: false, message: aviso };

  const supabase = await createClient();
  const [{ data: membresias }, { data: comercios }] = await Promise.all([
    supabase.from("business_memberships").select("profile_id, business_id, role, active"),
    supabase.from("businesses").select("id, name"),
  ]);
  const nombreComercio = new Map((comercios ?? []).map((c) => [c.id as string, c.name as string]));
  const filas = usuarios.map((u) => [
    u.fullName,
    u.email,
    ROLES_PLATAFORMA[u.platformRole]?.nombre ?? u.platformRole,
    ESTADOS_CUENTA[estadoCuenta(u)].nombre,
    (membresias ?? [])
      .filter((m) => m.profile_id === u.id)
      .map((m) => `${nombreComercio.get(m.business_id as string) ?? "?"} (${ROLE_LABELS[m.role as keyof typeof ROLE_LABELS]}${m.active ? "" : ", desactivado"})`)
      .join("; "),
    u.createdAt.slice(0, 10),
    u.lastSignInAt?.slice(0, 16).replace("T", " ") ?? "",
    u.suspendedReason ?? "",
  ]);
  await supabase.rpc("admin_record_action", { p_action: "platform.users_exported", p_entity_id: "usuarios", p_metadata: { filas: filas.length } });
  return {
    ok: true,
    csv: toCsv(["Nombre", "Correo", "Rol de plataforma", "Estado", "Comercios", "Alta", "Último acceso (UTC)", "Motivo de suspensión"], filas),
  };
}

export async function exportarAuditoriaAction(filtros: { grupo?: string; ambito?: string; actor?: string; desde?: string; hasta?: string }): Promise<ResultadoAdmin & { csv?: string; filas?: number }> {
  if (!(await exigirSuperadmin())) return NO_PERMITIDO;
  const grupo = filtros.grupo && filtros.grupo in GRUPOS_AUDITORIA ? (filtros.grupo as GrupoAuditoria) : undefined;
  const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
  const actor = id.optional().safeParse(filtros.actor || undefined);
  const ambito = filtros.ambito === "plataforma" || !filtros.ambito ? "plataforma" : id.safeParse(filtros.ambito).success ? filtros.ambito : "plataforma";
  const desde = fecha.safeParse(filtros.desde || undefined);
  const hasta = fecha.safeParse(filtros.hasta || undefined);

  const { filas, error } = await consultarAuditoria(
    { pagina: 1, grupo, ambito, actor: actor.success ? actor.data : undefined, desde: desde.success ? desde.data : undefined, hasta: hasta.success ? hasta.data : undefined },
    5000,
  );
  if (error) return { ok: false, message: "No se pudo leer la auditoría." };

  const supabase = await createClient();
  const { data: perfiles } = await supabase.from("profiles").select("id, full_name, email");
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string)]));
  await supabase.rpc("admin_record_action", { p_action: "platform.audit_exported", p_entity_id: "auditoria", p_metadata: { filas: filas.length, grupo: grupo ?? null, ambito } });
  return {
    ok: true,
    filas: filas.length,
    csv: toCsv(
      ["Fecha (UTC)", "Quién", "Acción", "Código", "Sobre", "Identificador", "Detalle"],
      filas.map((a) => [
        a.createdAt.slice(0, 19).replace("T", " "),
        a.actorId ? (nombre.get(a.actorId) ?? "Cuenta eliminada") : "Sistema",
        nombreAccion(a.action),
        a.action,
        a.entity,
        a.entityId,
        a.metadata && Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : "",
      ]),
    ),
  };
}
