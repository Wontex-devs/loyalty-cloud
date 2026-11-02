"use client";

import { usePlatform } from "@/components/admin/use-platform";
import { HBarList } from "@/components/business/charts";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/utils";

export default function PlatformAnalyticsPage() {
  const { rows, mrr } = usePlatform();
  const byCategory = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.business.category]: (acc[r.business.category] ?? 0) + 1 }), {}),
  ).map(([label, value]) => ({ label, value }));
  const byCity = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.business.city]: (acc[r.business.city] ?? 0) + r.customers }), {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const visits = rows.map((r) => ({ label: r.business.name.split(" ")[0], value: r.visits30d })).sort((a, b) => b.value - a.value);
  const totalCustomers = rows.reduce((s, r) => s + r.customers, 0);
  const totalRewards = rows.reduce((s, r) => s + r.rewards30d, 0);

  return (
    <>
      <PageHeader title="Estadísticas generales" description="Agregados de toda la plataforma (sin acceso a datos personales de clientes)." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="MRR" value={formatMoney(mrr)} />
        <StatCard label="ARPA" value={formatMoney(Math.round(mrr / Math.max(1, rows.filter((r) => r.business.status === "active").length)))} hint="Ingreso medio por comercio activo" />
        <StatCard label="Clientes por comercio" value={formatNumber(Math.round(totalCustomers / rows.length))} />
        <StatCard label="Canjes (30d)" value={formatNumber(totalRewards)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Visitas 30d por comercio" />
          <div className="p-5">
            <HBarList data={visits} format={formatNumber} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Clientes por ciudad" />
          <div className="p-5">
            <HBarList data={byCity} format={formatNumber} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Comercios por categoría" />
          <div className="p-5">
            <HBarList data={byCategory} />
          </div>
        </Card>
      </div>
    </>
  );
}
