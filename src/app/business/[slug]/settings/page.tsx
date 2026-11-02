"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { can } from "@/lib/domain/permissions";
import { useDemo } from "@/lib/demo/store";
import type { BusinessSettingsInput } from "@/lib/domain/schemas";
import { PUBLIC_HOST_LABEL } from "@/lib/config";
import { Badge, Button, ButtonLink, Card, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { PlanUsageCard, usageOf } from "@/components/business/plan-usage";
import { LocationsCard } from "@/components/business/locations-card";

const TIMEZONES = ["America/Bogota", "America/Mexico_City", "America/Lima", "America/Santiago", "America/Argentina/Buenos_Aires", "Europe/Madrid"];

export default function SettingsPage() {
  const scope = useScope();
  const { business, membership, locations } = scope;
  const { reset, mode, state, updateBusinessSettings } = useDemo();
  const plan = state.plans.find((p) => p.id === business.planId);
  const legal = business.legal ?? {};

  const [form, setForm] = useState<Required<BusinessSettingsInput>>({
    name: business.name,
    category: business.category,
    city: business.city,
    timezone: business.timezone,
    legalName: legal.legalName ?? "",
    taxId: legal.taxId ?? "",
    contactEmail: legal.contactEmail ?? "",
    contactPhone: legal.contactPhone ?? "",
    address: legal.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof BusinessSettingsInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };
  const legalComplete = !!(form.legalName && form.taxId && form.contactEmail);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateBusinessSettings(business.id, form);
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Configuración guardada." } : { ok: false, text: res.message });
  };

  return (
    <RequirePermission allowed={!!membership && can(membership, "staff.manage")}>
      <PageHeader title="Configuración" description="Datos del establecimiento, responsable del tratamiento de datos y plan." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <form onSubmit={save} className="space-y-4">
          <Card>
            <CardHeader title="Establecimiento" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre comercial">
                <Input value={form.name} onChange={set("name")} required />
              </Field>
              <Field label="Categoría">
                <Input value={form.category} onChange={set("category")} required />
              </Field>
              <Field label="Ciudad">
                <Input value={form.city} onChange={set("city")} required />
              </Field>
              <Field label="Zona horaria" hint="Se usa para las estadísticas por día y hora.">
                <Select value={form.timezone} onChange={set("timezone")}>
                  {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Enlace de registro" hint="Identificador único del comercio. Solo el superadministrador puede cambiarlo." className="sm:col-span-2">
                <Input value={`${PUBLIC_HOST_LABEL}/join/${business.slug}`} readOnly className="font-mono text-xs" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Responsable del tratamiento de datos"
              description="Aparece en la política de datos que aceptan tus clientes al inscribirse (Ley 1581 de 2012). Completa al menos razón social, NIT y correo antes de abrir el piloto."
              action={
                <Badge tone={legalComplete ? "success" : "warning"} dot>
                  {legalComplete ? "Completo" : "Pendiente"}
                </Badge>
              }
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Razón social o nombre del titular">
                <Input value={form.legalName} onChange={set("legalName")} placeholder="Beauty Club S.A.S." />
              </Field>
              <Field label="NIT o cédula">
                <Input value={form.taxId} onChange={set("taxId")} placeholder="900.000.000-0" />
              </Field>
              <Field label="Correo para consultas y reclamos" hint="Aquí los clientes ejercen sus derechos sobre sus datos.">
                <Input type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="datos@tucomercio.com" />
              </Field>
              <Field label="Teléfono de contacto">
                <Input type="tel" value={form.contactPhone} onChange={set("contactPhone")} placeholder="+57 300 000 0000" />
              </Field>
              <Field label="Dirección" className="sm:col-span-2">
                <Input value={form.address} onChange={set("address")} placeholder="Calle 00 # 00-00, Bogotá" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              <Link href={`/join/${business.slug}/terminos`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
                Ver la política pública <ExternalLink className="size-3.5" />
              </Link>
              <div className="flex items-center gap-3">
                {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</span>}
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Guardar cambios
                </Button>
              </div>
            </div>
          </Card>

          </form>

          <LocationsCard businessId={business.id} locations={locations} plan={plan} />
        </div>

        <div className="space-y-4">
          <PlanUsageCard plan={plan} usage={usageOf(scope)} />
          <Card className="p-5 text-sm">
            <p className="font-semibold">Auditoría</p>
            <p className="mt-1 text-muted">El registro completo de acciones está en Historial → Auditoría.</p>
            <ButtonLink href={`/business/${business.slug}/history`} variant="secondary" size="sm" className="mt-3">
              Abrir historial
            </ButtonLink>
          </Card>
          {mode === "demo" && (
            <Card className="border-danger/20 p-5 text-sm">
              <p className="font-semibold">Prototipo</p>
              <p className="mt-1 text-muted">Restablece los datos de demostración a su estado inicial.</p>
              <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={reset}>
                Restablecer datos demo
              </Button>
            </Card>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
