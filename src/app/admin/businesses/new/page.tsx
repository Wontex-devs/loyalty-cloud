"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { businessSchema } from "@/lib/domain/schemas";
import { useData } from "@/lib/data/store";
import { createBusinessAction } from "@/lib/data/actions";
import { useRouter } from "next/navigation";
import { PUBLIC_HOST_LABEL } from "@/lib/config";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";
import { usePuedeEditar } from "@/components/admin/piezas";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function NewBusinessPage() {
  const [form, setForm] = useState({ name: "", slug: "", category: "Salón de uñas", city: "", planId: "plan_starter", ownerName: "", ownerEmail: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { state } = useData();
  const plans = state.plans;
  const router = useRouter();
  const puedeEditar = usePuedeEditar();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = businessSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await createBusinessAction(form);
    setSaving(false);
    if (!res.ok) return setServerMsg(res.message);
    router.push(res.id ? `/admin/businesses/${res.id}` : "/admin/businesses");
    router.refresh();
  };

  if (!puedeEditar) {
    return <EmptyState icon={Store} title="Solo un superadministrador puede crear establecimientos" description="Con el rol de Soporte puedes ver los comercios, pero no crearlos." />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/businesses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Establecimientos
      </Link>
      <PageHeader title="Nuevo establecimiento" description="Crea el comercio, asigna un plan e invita a su propietario." />

      <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader title="Comercio" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre comercial" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })}
                />
              </Field>
              <Field label="Identificador público" hint={`${PUBLIC_HOST_LABEL}/join/${form.slug || "…"}`} error={errors.slug}>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm({ ...form, slug: slugify(e.target.value) });
                  }}
                  className="font-mono"
                />
              </Field>
              <Field label="Categoría" error={errors.category}>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {["Salón de uñas", "Salón de belleza", "Barbería", "Cafetería", "Restaurante", "Spa", "Otro"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Ciudad" error={errors.city}>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Plan" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {plans.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setForm({ ...form, planId: p.id })}
                  className={cn("rounded-xl border p-4 text-left transition", form.planId === p.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong")}
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted">{formatMoney(p.priceMonthly)}/mes</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Propietario" description="Recibirá una invitación para activar su cuenta." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre">
                <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
              </Field>
            </div>
          </Card>

          <div className="flex justify-end">
            {serverMsg && <p className="mr-auto self-center text-sm text-danger">{serverMsg}</p>}
            <Button type="submit" disabled={saving}>{saving ? "Creando…" : "Crear establecimiento"}</Button>
          </div>
        </form>
    </div>
  );
}
