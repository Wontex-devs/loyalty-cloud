"use client";

import { Check } from "lucide-react";
import { usePlatform } from "@/components/admin/use-platform";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/utils";

export default function PlansPage() {
  const { rows, state } = usePlatform();
  const plans = state.plans;
  return (
    <>
      <PageHeader title="Planes" description="Límites y precios que se aplican a cada establecimiento." actions={<Button disabled title="Próximamente">Nuevo plan</Button>} />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const count = rows.filter((r) => r.plan.id === p.id).length;
          return (
            <Card key={p.id} className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">{p.name}</p>
                <Badge>{count} comercios</Badge>
              </div>
              <p className="mt-3">
                <span className="tabular text-3xl font-semibold tracking-tight">{formatMoney(p.priceMonthly)}</span>
                <span className="text-sm text-muted"> / mes</span>
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-canvas p-3 text-center text-xs">
                <div>
                  <dt className="text-muted">Clientes</dt>
                  <dd className="mt-0.5 font-semibold">{p.maxCustomers ? formatNumber(p.maxCustomers) : "∞"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Empleados</dt>
                  <dd className="mt-0.5 font-semibold">{p.maxStaff ?? "∞"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Sedes</dt>
                  <dd className="mt-0.5 font-semibold">{p.maxLocations ?? "∞"}</dd>
                </div>
              </dl>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="mt-6" disabled title="Próximamente">
                Editar plan
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
