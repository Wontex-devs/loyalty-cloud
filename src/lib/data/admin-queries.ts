import "server-only";
import { createClient } from "@/lib/supabase/server";
import { GRUPOS_AUDITORIA, type GrupoAuditoria } from "@/lib/domain/acceso";
import type { AuditLog, PlatformRole } from "@/lib/domain/types";
import { toAuditLog } from "./mappers";

/**
 * Lecturas del panel de la plataforma. Siempre con la sesión de quien mira:
 * la base de datos solo responde a Superadministrador o Soporte (RLS y funciones de la migración 0019).
 */

export interface UsuarioPanel {
  id: string;
  fullName: string;
  email: string;
  platformRole: PlatformRole;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
  logins30d: number;
}

export interface InicioSesion {
  id: string;
  profileId: string;
  method: "password" | "magic_link" | "invite" | "recovery";
  createdAt: string;
}

/** Aviso cuando falta aplicar la migración 0019 en la base de datos. */
export const AVISO_MIGRACION =
  "La base de datos todavía no tiene la actualización del panel de usuarios (migración 0019). Aplícala en Supabase para ver esta información.";

const faltaMigracion = (e: { message?: string; code?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42P01" || e.code === "42883" || /admin_list_users|login_events|does not exist|Could not find/i.test(e.message ?? ""));

type Fila = Record<string, unknown>;
const aUsuario = (r: Fila): UsuarioPanel => ({
  id: String(r.id),
  fullName: (r.full_name as string) || (r.email as string),
  email: r.email as string,
  platformRole: r.platform_role as PlatformRole,
  createdAt: r.created_at as string,
  suspendedAt: (r.suspended_at as string) ?? null,
  suspendedReason: (r.suspended_reason as string) ?? null,
  lastSignInAt: (r.last_sign_in_at as string) ?? null,
  emailConfirmedAt: (r.email_confirmed_at as string) ?? null,
  invitedAt: (r.invited_at as string) ?? null,
  logins30d: Number(r.logins_30d ?? 0),
});
const aInicio = (r: Fila): InicioSesion => ({
  id: String(r.id),
  profileId: r.profile_id as string,
  method: r.method as InicioSesion["method"],
  createdAt: r.created_at as string,
});

export async function cargarUsuarios(): Promise<{ usuarios: UsuarioPanel[]; aviso: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) {
    console.error("[admin] usuarios", error.message);
    return { usuarios: [], aviso: faltaMigracion(error) ? AVISO_MIGRACION : "No se pudo cargar el listado de usuarios." };
  }
  return { usuarios: ((data ?? []) as Fila[]).map(aUsuario), aviso: null };
}

/** Inicios de sesión de los últimos días (para el resumen). */
export async function cargarIniciosRecientes(dias = 30): Promise<InicioSesion[]> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await supabase.from("login_events").select("*").gte("created_at", desde).order("created_at", { ascending: false }).limit(5000);
  if (error) return [];
  return ((data ?? []) as Fila[]).map(aInicio);
}

export async function cargarDetalleUsuario(id: string) {
  const supabase = await createClient();
  const [inicios, hechas, recibidas] = await Promise.all([
    supabase.from("login_events").select("*").eq("profile_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("audit_logs").select("*").eq("actor_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_logs").select("*").eq("entity", "profile").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  return {
    inicios: ((inicios.data ?? []) as Fila[]).map(aInicio),
    /** Lo que hizo esta persona. */
    actividad: (hechas.data ?? []).map(toAuditLog),
    /** Cambios hechos sobre su cuenta. */
    historial: (recibidas.data ?? []).map(toAuditLog),
  };
}

export const FILAS_POR_PAGINA = 25;

export interface FiltrosAuditoria {
  pagina: number;
  grupo?: GrupoAuditoria;
  /** "plataforma" = acciones generales; o el id de un comercio. */
  ambito?: string;
  actor?: string;
  desde?: string;
  hasta?: string;
}

export async function consultarAuditoria(f: FiltrosAuditoria, limite = FILAS_POR_PAGINA): Promise<{ filas: AuditLog[]; total: number; error: boolean }> {
  const supabase = await createClient();
  const desde = (Math.max(1, f.pagina) - 1) * limite;
  let q = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (!f.ambito || f.ambito === "plataforma") q = q.is("business_id", null);
  else q = q.eq("business_id", f.ambito);
  if (f.grupo && GRUPOS_AUDITORIA[f.grupo]) {
    q = q.or(GRUPOS_AUDITORIA[f.grupo].prefijos.map((p) => `action.like."${p}*"`).join(","));
  }
  if (f.actor) q = q.eq("actor_id", f.actor);
  if (f.desde) q = q.gte("created_at", `${f.desde}T00:00:00-05:00`);
  if (f.hasta) q = q.lte("created_at", `${f.hasta}T23:59:59-05:00`);
  const { data, count, error } = await q.range(desde, desde + limite - 1);
  if (error) {
    console.error("[admin] auditoría", error.message);
    return { filas: [], total: 0, error: true };
  }
  return { filas: (data ?? []).map(toAuditLog), total: count ?? 0, error: false };
}
