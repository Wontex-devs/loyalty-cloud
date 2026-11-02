/**
 * Matriz de permisos por rol. En la Etapa 2 se replica en políticas RLS y en
 * comprobaciones de Server Actions; la UI solo la usa para ocultar acciones.
 */
import type { BusinessMembership, BusinessRole } from "./types";

export type Permission =
  | "business.branding.edit"
  | "program.edit"
  | "customers.read"
  | "customers.export"
  | "visits.create"
  | "visits.reverse"
  | "rewards.redeem"
  | "staff.manage"
  | "analytics.read"
  | "settings.edit";

const MATRIX: Record<BusinessRole, Permission[]> = {
  owner: [
    "business.branding.edit",
    "program.edit",
    "customers.read",
    "customers.export",
    "visits.create",
    "visits.reverse",
    "rewards.redeem",
    "staff.manage",
    "analytics.read",
    "settings.edit",
  ],
  admin: [
    "business.branding.edit",
    "program.edit",
    "customers.read",
    "visits.create",
    "visits.reverse",
    "rewards.redeem",
    "staff.manage",
    "analytics.read",
  ],
  staff: ["customers.read", "visits.create"],
};

export function can(membership: Pick<BusinessMembership, "role" | "canRedeem">, p: Permission) {
  if (p === "rewards.redeem" && membership.role === "staff") return membership.canRedeem;
  return MATRIX[membership.role].includes(p);
}

export const ROLE_LABELS: Record<BusinessRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  staff: "Empleado",
};
