"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Download, Loader2, Printer, UserPlus } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { onboardingSteps, type StepId } from "@/components/business/onboarding";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { useDemo } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import type { BusinessBranding } from "@/lib/domain/types";
import { Button, ButtonLink, Card, Field, Input, PageHeader, Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

const PRESETS: { name: string; colors: Partial<BusinessBranding> }[] = [
  { name: "Rosa empolvado", colors: { cardBackground: "#EBCFCB", cardForeground: "#1A1416", primary: "#1A1416", primaryForeground: "#FFFFFF", accent: "#D8A7A7" } },
  { name: "Negro y rosa", colors: { cardBackground: "#141112", cardForeground: "#F1D3CF", primary: "#141112", primaryForeground: "#FFFFFF", accent: "#E7B9B3" } },
  { name: "Marfil", colors: { cardBackground: "#F6F1EA", cardForeground: "#1F1B16", primary: "#1F1B16", primaryForeground: "#FFFFFF", accent: "#CDB9A0" } },
  { name: "Salvia", colors: { cardBackground: "#D5DDCF", cardForeground: "#1E2A1E", primary: "#1E2A1E", primaryForeground: "#FFFFFF", accent: "#A9B99E" } },
  { name: "Lavanda", colors: { cardBackground: "#E3DDF2", cardForeground: "#2B2340", primary: "#2B2340", primaryForeground: "#FFFFFF", accent: "#B9AEDB" } },
];

/** Asistente de alta: deja un comercio nuevo listo para su primer cliente en pocos minutos. */
export default function OnboardingPage() {
  const scope = useScope();
  const { business, program, membership } = scope;
  const { updateBusinessSettings, updateProgram, updateBranding } = useDemo();
  const { steps, done, total } = onboardingSteps(scope);
  const [open, setOpen] = useState<StepId>(() => steps.find((s) => !s.done)?.id ?? "launch");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legal = business.legal ?? {};

  const [biz, setBiz] = useState({
    name: business.name,
    category: business.category,
    city: business.city,
    legalName: legal.legalName ?? "",
    taxId: legal.taxId ?? "",
    contactEmail: legal.contactEmail ?? "",
  });
  const [prog, setProg] = useState({
    stampsRequired: program?.stampsRequired ?? 9,
    rewardName: program && program.rewardName !== "Recompensa" ? program.rewardName : "",
    welcomeStamps: program?.welcomeStamps ?? 0,
  });
  const [logo, setLogo] = useState(business.branding.logoText);

  const next = (from: StepId) => {
    const order = steps.map((s) => s.id);
    setOpen(order[Math.min(order.indexOf(from) + 1, order.length - 1)]);
    setError(null);
  };

  const saveBusiness = async () => {
    setSaving(true);
    const res = await updateBusinessSettings(business.id, {
      ...biz,
      timezone: business.timezone,
      contactPhone: legal.contactPhone ?? "",
      address: legal.address ?? "",
    });
    setSaving(false);
    if (!res.ok) return setError(res.message);
    next("business");
  };

  const saveProgram = () => {
    if (!program) return;
    if (prog.rewardName.trim().length < 2) return setError("Escribe la recompensa, por ejemplo «Manicura gratis».");
    if (prog.stampsRequired < 2 || prog.stampsRequired > 30) return setError("Las visitas deben estar entre 2 y 30.");
    if (prog.welcomeStamps >= prog.stampsRequired) return setError("Los sellos de regalo deben ser menos que las visitas.");
    updateProgram(program.id, { stampsRequired: prog.stampsRequired, rewardName: prog.rewardName.trim(), welcomeStamps: prog.welcomeStamps });
    next("program");
  };

  const chooseBrand = (colors: Partial<BusinessBranding>) => updateBranding(business.id, { ...colors, logoText: logo.trim().slice(0, 3) || business.branding.logoText });

  return (
    <RequirePermission allowed={!!membership && can(membership, "program.edit")}>
      <PageHeader title="Primeros pasos" description={`Deja ${business.name} listo para recibir a su primer cliente. Puedes volver aquí cuando quieras.`} />

      <Card className="mb-4 p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">
            {done} de {total} pasos
          </span>
          <span className="text-muted">{Math.round((done / total) * 100)}%</span>
        </div>
        <Progress value={(done / total) * 100} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {steps.map((s, i) => (
            <Card key={s.id} className={cn(open === s.id && "ring-1 ring-ink/10")}>
              <button type="button" onClick={() => setOpen(s.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    s.done ? "bg-success text-white" : "bg-black/[0.06] text-ink-2",
                  )}
                >
                  {s.done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="flex-1 text-sm font-medium">
                  {s.title} {s.optional && <span className="font-normal text-muted">(opcional)</span>}
                </span>
                <ChevronRight className={cn("size-4 text-subtle transition-transform", open === s.id && "rotate-90")} />
              </button>

              {open === s.id && (
                <div className="border-t border-line p-5">
                  {error && <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

                  {s.id === "business" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nombre comercial">
                        <Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
                      </Field>
                      <Field label="Ciudad">
                        <Input value={biz.city} onChange={(e) => setBiz({ ...biz, city: e.target.value })} />
                      </Field>
                      <Field label="Razón social o titular" hint="Responsable de los datos de tus clientes.">
                        <Input value={biz.legalName} onChange={(e) => setBiz({ ...biz, legalName: e.target.value })} />
                      </Field>
                      <Field label="NIT o cédula">
                        <Input value={biz.taxId} onChange={(e) => setBiz({ ...biz, taxId: e.target.value })} />
                      </Field>
                      <Field label="Correo para consultas y reclamos" className="sm:col-span-2">
                        <Input type="email" value={biz.contactEmail} onChange={(e) => setBiz({ ...biz, contactEmail: e.target.value })} />
                      </Field>
                      <div className="flex justify-end sm:col-span-2">
                        <Button onClick={saveBusiness} disabled={saving}>
                          {saving && <Loader2 className="size-4 animate-spin" />} Guardar y seguir
                        </Button>
                      </div>
                    </div>
                  )}

                  {s.id === "program" && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Visitas para el premio">
                        <Input type="number" min={2} max={30} value={prog.stampsRequired} onChange={(e) => setProg({ ...prog, stampsRequired: Number(e.target.value) })} />
                      </Field>
                      <Field label="Recompensa" className="sm:col-span-2">
                        <Input placeholder="Ej.: Manicura gratis" value={prog.rewardName} onChange={(e) => setProg({ ...prog, rewardName: e.target.value })} />
                      </Field>
                      <Field label="Sellos de regalo al inscribirse" hint="0 si no quieres regalar sellos.">
                        <Input type="number" min={0} max={5} value={prog.welcomeStamps} onChange={(e) => setProg({ ...prog, welcomeStamps: Number(e.target.value) })} />
                      </Field>
                      <div className="flex items-end justify-between gap-2 sm:col-span-2">
                        <Link href={`/business/${business.slug}/program`} className="text-sm text-muted underline">
                          Más opciones (cumpleaños, vencimiento…)
                        </Link>
                        <Button onClick={saveProgram}>Guardar y seguir</Button>
                      </div>
                    </div>
                  )}

                  {s.id === "brand" && (
                    <div className="space-y-4">
                      <Field label="Iniciales del logo" hint="Hasta 3 letras. Aparecen en la tarjeta y en el icono de la app.">
                        <Input value={logo} maxLength={3} onChange={(e) => setLogo(e.target.value.toUpperCase())} className="w-28" />
                      </Field>
                      <div>
                        <p className="mb-2 text-[13px] font-medium">Elige tus colores</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {PRESETS.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => chooseBrand(p.colors)}
                              className={cn(
                                "rounded-xl border p-2 text-left text-xs transition",
                                business.branding.cardBackground === p.colors.cardBackground ? "border-ink" : "border-line hover:border-line-strong",
                              )}
                            >
                              <span className="mb-1.5 block h-10 rounded-lg" style={{ background: p.colors.cardBackground, boxShadow: `inset 0 -10px 0 ${p.colors.cardForeground}` }} />
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/business/${business.slug}/card-design`} className="text-sm text-muted underline">
                          Colores personalizados
                        </Link>
                        <Button onClick={() => next("brand")}>Seguir</Button>
                      </div>
                    </div>
                  )}

                  {s.id === "team" && (
                    <div className="space-y-3 text-sm">
                      <p className="text-muted">Invita a quienes te ayudan a atender el programa. Cada persona entra con su propio usuario y tú decides quién puede entregar premios.</p>
                      <div className="flex justify-between gap-2">
                        <ButtonLink href={`/business/${business.slug}/staff`} variant="secondary">
                          <UserPlus className="size-4" /> Invitar a mi equipo
                        </ButtonLink>
                        <Button variant="ghost" onClick={() => next("team")}>
                          Lo haré después
                        </Button>
                      </div>
                    </div>
                  )}

                  {s.id === "launch" && (
                    <div className="space-y-3 text-sm">
                      <p className="text-muted">Imprime el cartel con tu QR y ponlo en caja. Prueba inscribiéndote tú primero desde tu celular.</p>
                      <div className="flex flex-wrap gap-2">
                        <ButtonLink href={`/join/${business.slug}/poster`} target="_blank" variant="secondary">
                          <Printer className="size-4" /> Cartel para imprimir
                        </ButtonLink>
                        <ButtonLink href={`/business/${business.slug}/card-design`} variant="secondary">
                          <Download className="size-4" /> QR en PNG
                        </ButtonLink>
                        <ButtonLink href={`/join/${business.slug}`} target="_blank" variant="secondary">
                          Abrir página de inscripción
                        </ButtonLink>
                      </div>
                      {s.done && <p className="font-medium text-success">¡Ya tienes tu primer cliente! Tu programa está en marcha.</p>}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Así verán su tarjeta</p>
          <LoyaltyCardView
            business={{ ...business, branding: { ...business.branding, logoText: logo || business.branding.logoText } }}
            program={{ name: business.name, stampsRequired: Math.max(2, Math.min(30, prog.stampsRequired || 2)), rewardName: prog.rewardName || "Tu recompensa" }}
            customerName="Nombre del cliente"
            stamps={Math.min(prog.welcomeStamps, prog.stampsRequired - 1)}
            status="active"
            rewardsAvailable={0}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
