"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { useDemo } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import { programSchema, type ProgramInput } from "@/lib/domain/schemas";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Switch, Textarea } from "@/components/ui";

export default function ProgramPage() {
  const { business, program, membership, cards } = useScope();
  const { updateProgram } = useDemo();
  const [form, setForm] = useState<ProgramInput | null>(() =>
    program
      ? {
          name: program.name,
          description: program.description,
          stampsRequired: program.stampsRequired,
          rewardName: program.rewardName,
          rewardDescription: program.rewardDescription,
          minMinutesBetweenVisits: program.minMinutesBetweenVisits,
          rewardExpiryDays: program.rewardExpiryDays ?? 0,
          welcomeStamps: program.welcomeStamps ?? 0,
          birthdayReward: program.birthdayReward ?? "",
          terms: program.terms,
        }
      : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (!program || !form) return null;
  const set = <K extends keyof ProgramInput>(k: K, v: ProgramInput[K]) => {
    setForm({ ...form, [k]: v });
    setSaved(false);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = programSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    if (parsed.data.welcomeStamps >= parsed.data.stampsRequired) {
      setErrors({ welcomeStamps: "Deben ser menos que las visitas necesarias." });
      return;
    }
    setErrors({});
    updateProgram(program.id, { ...parsed.data, rewardExpiryDays: parsed.data.rewardExpiryDays || null, birthdayReward: parsed.data.birthdayReward || null });
    setSaved(true);
  };

  const stampsChanged = form.stampsRequired !== program.stampsRequired;

  return (
    <RequirePermission allowed={!!membership && can(membership, "program.edit")}>
      <PageHeader
        title="Mi programa"
        description="Define cómo tus clientes acumulan visitas y qué reciben al completar la tarjeta."
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Badge tone={program.active ? "success" : "neutral"} dot>
              {program.active ? "Activo" : "Pausado"}
            </Badge>
            <Switch checked={program.active} onChange={(v) => updateProgram(program.id, { active: v })} label="Programa activo" />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={save} className="space-y-4">
          <Card>
            <CardHeader title="General" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre del programa" error={errors.name} className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Descripción" hint="Se muestra en la página de registro." error={errors.description} className="sm:col-span-2">
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-20" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Regla de acumulación" description="Un sello por visita registrada por tu equipo." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="Visitas necesarias"
                error={errors.stampsRequired}
                hint={stampsChanged ? `Se aplicará a ${cards.length} tarjetas; los sellos actuales se conservan.` : "Entre 2 y 30."}
              >
                <Input type="number" min={2} max={30} value={form.stampsRequired} onChange={(e) => set("stampsRequired", Number(e.target.value))} />
              </Field>
              <Field label="Tiempo mínimo entre visitas (min)" hint="Evita registros dobles por error." error={errors.minMinutesBetweenVisits}>
                <Input type="number" min={0} value={form.minMinutesBetweenVisits} onChange={(e) => set("minMinutesBetweenVisits", Number(e.target.value))} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recompensa" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre de la recompensa" error={errors.rewardName} className="sm:col-span-2">
                <Input value={form.rewardName} onChange={(e) => set("rewardName", e.target.value)} />
              </Field>
              <Field label="Detalle" error={errors.rewardDescription} className="sm:col-span-2">
                <Input value={form.rewardDescription} onChange={(e) => set("rewardDescription", e.target.value)} />
              </Field>
              <Field label="Vigencia (días)" hint="0 = sin vencimiento." error={errors.rewardExpiryDays}>
                <Input type="number" min={0} value={form.rewardExpiryDays} onChange={(e) => set("rewardExpiryDays", Number(e.target.value))} />
              </Field>
              <Field label="Sellos de bienvenida" hint="Regalo al inscribirse: la tarjeta nueva empieza con estos sellos (0 a 5)." error={errors.welcomeStamps}>
                <Input type="number" min={0} max={5} value={form.welcomeStamps} onChange={(e) => set("welcomeStamps", Number(e.target.value))} />
              </Field>
              <Field
                label="Regalo de cumpleaños"
                hint="Se entrega solo en la primera visita del mes de cumpleaños (una vez al año) y vence a los 30 días. Déjalo vacío para no ofrecerlo."
                error={errors.birthdayReward}
                className="sm:col-span-2"
              >
                <Input value={form.birthdayReward} onChange={(e) => set("birthdayReward", e.target.value)} placeholder="Ej.: Esmaltado gratis" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Términos y condiciones del programa" />
            <div className="p-5">
              <Textarea value={form.terms} onChange={(e) => set("terms", e.target.value)} />
            </div>
          </Card>

          <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-line bg-surface/90 p-3 shadow-pop backdrop-blur">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <Check className="size-4" /> Cambios guardados
              </span>
            )}
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Vista previa</p>
          <LoyaltyCardView
            business={business}
            program={{ name: form.name, stampsRequired: Math.max(2, Math.min(30, form.stampsRequired || 2)), rewardName: form.rewardName }}
            customerName="Nombre del cliente"
            stamps={Math.min(3, form.stampsRequired)}
            status="active"
            rewardsAvailable={0}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
