/**
 * Roles, estados de cuenta y textos del panel de la plataforma.
 * Los permisos reales los aplica la base de datos (RLS y funciones de Postgres, migración 0019);
 * aquí solo se decide qué mostrar y se explican las reglas.
 */
import type { AuditLog, BusinessRole, PlatformRole } from "./types";
import type { Permission } from "./permissions";

type ConRol = { platformRole: PlatformRole; suspendedAt?: string | null } | null | undefined;

/** Superadministrador activo: puede leer y cambiar todo el panel de la plataforma. */
export const esSuperadmin = (p: ConRol) => p?.platformRole === "superadmin" && !p.suspendedAt;
/** Superadministrador o Soporte activos: pueden ver el panel de la plataforma. */
export const puedeVerPlataforma = (p: ConRol) => (p?.platformRole === "superadmin" || p?.platformRole === "support") && !p.suspendedAt;

export const ROLES_PLATAFORMA: Record<PlatformRole, { nombre: string; corto: string; descripcion: string }> = {
  superadmin: {
    nombre: "Superadministrador",
    corto: "Superadmin",
    descripcion: "Acceso total a la plataforma: comercios, planes, usuarios, roles y auditoría.",
  },
  support: {
    nombre: "Soporte (supervisor)",
    corto: "Soporte",
    descripcion: "Ve el panel de la plataforma para ayudar a los comercios, pero no puede cambiar nada.",
  },
  user: {
    nombre: "Usuario de comercio",
    corto: "Usuario",
    descripcion: "Solo entra a los comercios donde lo invitaron, con el rol que tenga en cada uno.",
  },
};

export const ROLES_COMERCIO: Record<BusinessRole, { nombre: string; descripcion: string }> = {
  owner: { nombre: "Propietario", descripcion: "Dueño del comercio: todo, incluido exportar clientes y la configuración." },
  admin: { nombre: "Administrador", descripcion: "Gestiona el programa, el equipo y las estadísticas, sin exportar clientes." },
  staff: { nombre: "Empleado", descripcion: "Registra visitas y consulta clientes. Canjea premios solo si se le permite." },
};

/* ---------- Estado de la cuenta ---------- */

export type EstadoCuenta = "activa" | "inactiva" | "pendiente" | "suspendida";

export const DIAS_ACTIVA = 30;

export const ESTADOS_CUENTA: Record<EstadoCuenta, { nombre: string; descripcion: string; tono: "success" | "neutral" | "warning" | "danger" }> = {
  activa: { nombre: "Activa", descripcion: `Entró en los últimos ${DIAS_ACTIVA} días.`, tono: "success" },
  inactiva: { nombre: "Inactiva", descripcion: `No entra hace más de ${DIAS_ACTIVA} días, o nunca ha entrado.`, tono: "neutral" },
  pendiente: { nombre: "Invitación pendiente", descripcion: "Recibió la invitación pero todavía no ha creado su contraseña.", tono: "warning" },
  suspendida: { nombre: "Suspendida", descripcion: "No puede entrar ni ver datos hasta que la reactiven.", tono: "danger" },
};

export interface DatosAcceso {
  suspendedAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
}

export function estadoCuenta(u: DatosAcceso, ahora = Date.now()): EstadoCuenta {
  if (u.suspendedAt) return "suspendida";
  if (!u.lastSignInAt && !u.emailConfirmedAt) return "pendiente";
  if (u.lastSignInAt && ahora - new Date(u.lastSignInAt).getTime() <= DIAS_ACTIVA * 86_400_000) return "activa";
  return "inactiva";
}

/* ---------- Auditoría: nombres legibles ---------- */

const ACCIONES: Record<string, string> = {
  "platform.role_changed": "Cambió el rol de plataforma",
  "platform.user_suspended": "Suspendió una cuenta",
  "platform.user_reactivated": "Reactivó una cuenta",
  "platform.profile_updated": "Editó los datos de una cuenta",
  "platform.password_reset_sent": "Envió un enlace para cambiar la contraseña",
  "platform.access_link_sent": "Reenvió la invitación",
  "platform.users_exported": "Exportó el listado de usuarios",
  "platform.audit_exported": "Exportó la auditoría",
  "platform.user_invited": "Invitó a una persona",
  "platform.superadmin_granted": "Nombró superadministrador",
  "platform.superadmin_revoked": "Quitó el rol de superadministrador",
  "platform.user_deleted": "Eliminó una cuenta",
  "platform.business_deleted": "Eliminó un comercio",
  "business.created": "Creó un comercio",
  "business.active": "Activó un comercio",
  "business.suspended": "Suspendió un comercio",
  "business.trial": "Puso un comercio en prueba",
  "business.updated": "Cambió los datos de un comercio",
  "business.plan_changed": "Cambió el plan de un comercio",
  "business_memberships.insert": "Agregó una persona a un comercio",
  "business_memberships.update": "Cambió el acceso de una persona a un comercio",
  "business_memberships.delete": "Quitó a una persona de un comercio",
  "loyalty_programs.insert": "Creó un programa de puntos",
  "loyalty_programs.update": "Cambió un programa de puntos",
};

export const nombreAccion = (accion: string) => ACCIONES[accion] ?? accion;

/** Explica en palabras los cambios más comunes (rol, nombre, motivo). */
export function describirDetalle(a: AuditLog): string | null {
  const m = (a.metadata ?? {}) as Record<string, unknown>;
  const rol = (r: unknown) => ROLES_PLATAFORMA[r as PlatformRole]?.nombre ?? String(r);
  if (a.action === "platform.role_changed") return `De ${rol(m.from)} a ${rol(m.to)}`;
  if (a.action === "platform.profile_updated") return `Nombre: «${m.from}» → «${m.to}»`;
  if (a.action === "platform.user_suspended") return m.reason ? `Motivo: ${m.reason}` : null;
  if (a.action === "platform.user_invited") {
    const r = m.rol as string;
    return m.tipo === "plataforma" ? `Como ${rol(r)}` : `Como ${ROLES_COMERCIO[r as BusinessRole]?.nombre ?? r}`;
  }
  if (a.action.endsWith("_exported") && typeof m.filas === "number") return `${m.filas} filas`;
  if (Array.isArray(m.changed) && m.changed.length) return `Cambió: ${(m.changed as string[]).join(", ")}`;
  if (typeof m.reason === "string" && m.reason) return `Motivo: ${m.reason}`;
  return null;
}

/** Filtros del registro de auditoría: grupos de acciones. */
export const GRUPOS_AUDITORIA = {
  usuarios: { nombre: "Usuarios y roles", prefijos: ["platform.role_", "platform.user_", "platform.profile_", "platform.superadmin_", "platform.password_", "platform.access_"] },
  comercios: { nombre: "Comercios", prefijos: ["business.", "platform.business_"] },
  equipos: { nombre: "Equipos de los comercios", prefijos: ["business_memberships."] },
  exportaciones: { nombre: "Exportaciones", prefijos: ["platform.users_exported", "platform.audit_exported"] },
} as const;
export type GrupoAuditoria = keyof typeof GRUPOS_AUDITORIA;

/* ---------- Qué puede hacer cada rol (lo que de verdad aplica la base de datos) ---------- */

export const PERMISOS_PLATAFORMA: { permiso: string; superadmin: boolean; support: boolean; user: boolean }[] = [
  { permiso: "Ver el resumen, los comercios y las estadísticas de la plataforma", superadmin: true, support: true, user: false },
  { permiso: "Ver usuarios, inicios de sesión y auditoría", superadmin: true, support: true, user: false },
  { permiso: "Crear comercios, cambiar su plan o su estado y eliminarlos", superadmin: true, support: false, user: false },
  { permiso: "Invitar personas, cambiar roles, suspender y eliminar cuentas", superadmin: true, support: false, user: false },
  { permiso: "Exportar usuarios y auditoría", superadmin: true, support: false, user: false },
  { permiso: "Ver datos personales de los clientes de un comercio", superadmin: false, support: false, user: false },
];

/** Permisos dentro de un comercio, en palabras (la matriz está en permissions.ts y la aplica RLS). */
export const PERMISOS_COMERCIO_TEXTO: Record<Permission, string> = {
  "visits.create": "Registrar visitas y sellos",
  "customers.read": "Ver clientes",
  "rewards.redeem": "Canjear premios",
  "visits.reverse": "Corregir visitas",
  "program.edit": "Cambiar el programa de puntos",
  "business.branding.edit": "Cambiar el diseño de la tarjeta",
  "staff.manage": "Gestionar el equipo",
  "analytics.read": "Ver estadísticas",
  "customers.export": "Exportar clientes",
  "settings.edit": "Cambiar la configuración del comercio",
};
