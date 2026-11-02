"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Tag } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { useDemo, type PromotionInput } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import { promotionSchema } from "@/lib/domain/schemas";
import { activePromotion, bonusLabel, localDay, WEEKDAY_LABELS } from "@/lib/domain/promotions";
import type { Promotion } from "@/lib/domain/types";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Switch } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const fmtDay = (d: string) => formatDate(`${d}T12:00:00`);

function emptyForm(today: string): PromotionInput {
  return { name: "Doble sello", bonusStamps: 1, startsOn: today, endsOn: today, weekdays: ALL_DAYS, active: true };
}

export default function PromotionsPage() {
  const { business, membership, promotions, visits } = useScope();
  const { savePromotion } = useDemo();
  const today = localDay(new Date(), business.timezone).date;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<PromotionInput>(() => emptyForm(today));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const live = activePromotion(promotions, new Date(), business.timezone);

  const open = (p?: Promotion) => {
    setError(null);
    setEditing(p ? p.id : "new");
    setForm(p ? { name: p.name, bonusStamps: p.bonusStamps, startsOn: p.startsOn, endsOn: p.endsOn, weekdays: p.weekdays, active: p.active } : emptyForm(today));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = promotionSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
    setSaving(true);
    const res = await savePromotion(business.id, parsed.data, editing && editing !== "new" ? editing : undefined);
    setSaving(false);
    if (!res.ok) return setError(res.message);
    setEditing(null);
  };

  const toggle = (p: Promotion) =>
    savePromotion(business.id, { name: p.name, bonusStamps: p.bonusStamps, startsOn: p.startsOn, endsOn: p.endsOn, weekdays: p.weekdays, active: !p.active }, p.id);

  const status = (p: Promotion) => {
    if (!p.active) return { label: "Pausada", tone: "neutral" as const };
    if (live?.id === p.id) return { label: "Activa hoy", tone: "success" as const };
    if (p.endsOn < today) return { label: "Terminada", tone: "neutral" as const };
    if (p.startsOn > today) return { label: "Programada", tone: "info" as const };
    return { label: "Hoy no aplica", tone: "warning" as const };
  };

  const sorted = [...promotions].sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  return (
    <RequirePermission allowed={!!membership && can(membership, "program.edit")}>
      <PageHeader
        title="Promociones"
        description="Sellos extra en fechas o días concretos, por ejemplo un doble sello los martes. Se aplican solas al registrar la visita."
        actions={
          editing === null ? (
            <Button onClick={() => open()}>
              <Plus className="size-4" /> Nueva promoción
            </Button>
          ) : undefined
        }
      />

      {live && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
          <Tag className="size-4 shrink-0" />
          <span>
            Hoy está activa <strong>{live.name}</strong>: cada visita suma {1 + live.bonusStamps} sellos.
          </span>
        </div>
      )}

      {editing !== null && (
        <Card className="mb-4">
          <CardHeader title={editing === "new" ? "Nueva promoción" : "Editar promoción"} />
          <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nombre" hint="Lo verán tus clientas en su tarjeta.">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select value={form.bonusStamps} onChange={(e) => setForm({ ...form, bonusStamps: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {bonusLabel(n)} ({1 + n} sellos por visita)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Desde">
              <Input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
            </Field>
            <Field label="Hasta" hint="Incluido. Máximo un año.">
              <Input type="date" value={form.endsOn} min={form.startsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium">Días de la semana</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAYS.map((d) => {
                  const on = form.weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort() })}
                      className={cn("h-9 w-12 rounded-lg border text-sm font-medium", on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-muted")}
                    >
                      {WEEKDAY_LABELS[d - 1]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <span className="flex items-center gap-2 text-sm">
                <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Activa" /> Activa
              </span>
              <div className="flex items-center gap-2">
                {error && <span className="text-sm text-danger">{error}</span>}
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Guardar
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {sorted.length === 0 ? (
          <EmptyState icon={Tag} title="Aún no tienes promociones" description="Crea un doble sello para un día flojo de la semana o una temporada especial." />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((p) => {
              const st = status(p);
              const uses = visits.filter((v) => v.promotionId === p.id).length;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {p.name} <Badge tone={st.tone} dot>{st.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {bonusLabel(p.bonusStamps)} · {fmtDay(p.startsOn)} – {fmtDay(p.endsOn)} ·{" "}
                      {p.weekdays.length === 7 ? "todos los días" : p.weekdays.map((d) => WEEKDAY_LABELS[d - 1]).join(", ")}
                      {uses > 0 && ` · usada en ${uses} ${uses === 1 ? "visita" : "visitas"}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
                    {p.active ? "Pausar" : "Reactivar"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => open(p)}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </RequirePermission>
  );
}
