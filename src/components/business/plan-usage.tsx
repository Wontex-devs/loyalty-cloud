"use client";

import type { Plan } from "@/lib/domain/types";
import { Card, CardHeader, Progress } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/utils";

export interface PlanUsageData {
  customers: number;
  staff: number;
  locations: number;
}

/** Uso del plan: clientes, equipo y sedes frente a los límites. */
export function usageOf(scope: { customers: unknown[]; memberships: { role: string; active: boolean }[]; locations: { active: boolean }[] }): PlanUsageData {
  return {
    customers: scope.customers.length,
    staff: scope.memberships.filter((m) => m.active && m.role !== "owner").length,
    locations: scope.locations.filter((l) => l.active).length,
  };
}

export const isFull = (used: number, max: number | null | undefined) => !!max && used >= max;

export function PlanUsageCard({ plan, usage }: { plan?: Plan; usage: PlanUsageData }) {
  if (!plan) return null;
  const rows: [string, number, number | null][] = [
    ["Clientes", usage.customers, plan.maxCustomers],
    ["Equipo (sin contar al propietario)", usage.staff, plan.maxStaff],
    ["Sedes activas", usage.locations, plan.maxLocations],
  ];
  return (
    <Card>
      <CardHeader title={`Plan ${plan.name}`} description={`${formatMoney(plan.priceMonthly)} / mes`} />
      <div className="space-y-4 p-5 text-sm">
        {rows.map(([label, used, max]) => {
          const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
          return (
            <div key={label}>
              <div className="mb-1.5 flex justify-between gap-2">
                <span className="text-muted">{label}</span>
                <span className={pct >= 90 ? "font-semibold text-danger" : pct >= 80 ? "font-semibold text-warning" : "font-medium"}>
                  {formatNumber(used)} / {max ? formatNumber(max) : "∞"}
                </span>
              </div>
              {max ? <Progress value={pct} /> : <p className="text-xs text-subtle">Sin límite</p>}
            </div>
          );
        })}
        <p className="border-t border-line pt-3 text-xs text-muted">¿Necesitas más? Pide el cambio de plan a la administración de la plataforma.</p>
      </div>
    </Card>
  );
}
