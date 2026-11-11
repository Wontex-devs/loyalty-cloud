import type { BusinessScope } from "@/lib/demo/store";

export type StepId = "business" | "program" | "brand" | "team" | "launch";

/** Pasos del alta de un comercio. Se calculan con sus datos: no hay que marcarlos a mano. */
export function onboardingSteps(scope: BusinessScope) {
  const { business, program, memberships, customers } = scope;
  const legal = business.legal ?? {};
  const steps: { id: StepId; title: string; done: boolean; optional?: boolean }[] = [
    { id: "business", title: "Tu negocio y datos legales", done: !!(legal.legalName && legal.taxId && legal.contactEmail) },
    { id: "program", title: "Tu programa de sellos", done: !!program && program.rewardName.trim().toLowerCase() !== "recompensa" },
    // create_business deja el negro por defecto (#111111): cambiarlo indica que se eligió una marca.
    { id: "brand", title: "Tu marca", done: business.branding.primary.toLowerCase() !== "#111111" },
    { id: "team", title: "Tu equipo", done: memberships.some((m) => m.role !== "owner" && m.active), optional: true },
    { id: "launch", title: "Primer cliente inscrito", done: customers.length > 0 },
  ];
  const required = steps.filter((s) => !s.optional);
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length, complete: required.every((s) => s.done) };
}
