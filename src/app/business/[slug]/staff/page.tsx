"use client";

import { isFull, usageOf } from "@/components/business/plan-usage";
import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { useData } from "@/lib/data/store";
import { can, ROLE_LABELS } from "@/lib/domain/permissions";
import { staffInviteSchema } from "@/lib/domain/schemas";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Switch, Table, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { BusinessRole } from "@/lib/domain/types";

const PERMS = [
  ["Canjear recompensas", true, true, "Configurable"],
  ["Revertir visitas", true, true, false],
  ["Editar programa y tarjeta", true, true, false],
  ["Gestionar empleados", true, true, false],
  ["Estadísticas", true, true, false],
  ["Exportar clientes y facturación", true, false, false],
] as const;

export default function StaffPage() {
  const scope = useScope();
  const { business, memberships, profiles, visits, membership, plan } = scope;
  const staffFull = isFull(usageOf(scope).staff, plan?.maxStaff);
  const { inviteStaff, toggleMembership } = useData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", role: "staff" as BusinessRole, canRedeem: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = staffInviteSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    inviteStaff(business.id, parsed.data);
    setForm({ fullName: "", email: "", role: "staff", canRedeem: false });
    setErrors({});
    setOpen(false);
  };

  const d30 = Date.now() - 30 * 86400000;

  return (
    <RequirePermission allowed={!!membership && can(membership, "staff.manage")}>
      <PageHeader
        title="Empleados"
        description="Gestiona quién puede ver a tus clientes y canjear recompensas."
        actions={
          <Button onClick={() => setOpen(true)} disabled={staffFull} title={staffFull ? "Alcanzaste el límite de tu plan" : undefined}>
            <UserPlus className="size-4" /> Invitar empleado
          </Button>
        }
      />

      {staffFull && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          Tu plan {plan?.name} permite {plan?.maxStaff} {plan?.maxStaff === 1 ? "persona" : "personas"} en el equipo (sin contarte a ti). Desactiva a alguien o pide un
          cambio de plan para invitar a más.
        </div>
      )}

      {open && (
        <Card className="animate-fade-up mb-4">
          <CardHeader
            title="Nueva invitación"
            description="Recibirá un enlace por correo para crear su contraseña."
            action={
              <button onClick={() => setOpen(false)} aria-label="Cerrar">
                <X className="size-4 text-muted" />
              </button>
            }
          />
          <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Field label="Nombre" error={errors.fullName}>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Correo" error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Rol">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as BusinessRole })}>
                <option value="staff">Empleado</option>
                <option value="admin">Administrador</option>
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.role === "admin" || form.canRedeem} onChange={(v) => setForm({ ...form, canRedeem: v })} /> Puede canjear
              </label>
              <Button type="submit">Invitar</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Miembro</Th>
              <Th>Rol</Th>
              <Th>Canjes</Th>
              <Th>Visitas (30d)</Th>
              <Th>Desde</Th>
              <Th>Activo</Th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => {
              const p = profiles.find((x) => x.id === m.profileId)!;
              const isOwner = m.role === "owner";
              return (
                <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.fullName} />
                      <div>
                        <p className="font-medium">{p.fullName}</p>
                        <p className="text-xs text-muted">{p.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={isOwner ? "brand" : m.role === "admin" ? "info" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
                  </Td>
                  <Td>
                    {m.role === "staff" ? (
                      <Switch checked={m.canRedeem} onChange={(v) => toggleMembership(m.id, { canRedeem: v })} label="Puede canjear" />
                    ) : (
                      <span className="text-xs text-muted">Siempre</span>
                    )}
                  </Td>
                  <Td className="tabular">{visits.filter((v) => v.staffId === m.profileId && v.kind === "visit" && new Date(v.createdAt).getTime() > d30).length}</Td>
                  <Td className="text-muted">{formatDate(m.createdAt)}</Td>
                  <Td>{!isOwner && <Switch checked={m.active} onChange={(v) => toggleMembership(m.id, { active: v })} label="Activo" />}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Permisos por rol" description="Se aplican también en el servidor y en la base de datos (RLS), no solo en la interfaz." />
        <Table>
          <thead>
            <tr>
              <Th>Acción</Th>
              <Th>Propietario</Th>
              <Th>Administrador</Th>
              <Th>Empleado</Th>
            </tr>
          </thead>
          <tbody>
            {PERMS.map(([label, ...vals]) => (
              <tr key={label}>
                <Td>{label}</Td>
                {vals.map((v, i) => (
                  <Td key={i} className={v === true ? "text-success" : v === false ? "text-subtle" : "text-muted"}>
                    {v === true ? "✓" : v === false ? "—" : v}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </RequirePermission>
  );
}
