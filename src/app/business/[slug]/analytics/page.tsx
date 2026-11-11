"use client";

import { useEffect, useState } from "react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { BarChart, HBarList } from "@/components/business/charts";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import type { BusinessStats } from "@/lib/domain/stats";
import { Card, CardHeader, EmptyState, PageHeader, Segmented, StatCard, Table, Td, Th } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

type Range = "7" | "30" | "90";
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dayFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function AnalyticsPage() {
  const { business, program, membership, visits, redemptions } = useScope();
  const { getStats } = useData();
  const [range, setRange] = useState<Range>("30");
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = !!membership && can(membership, "analytics.read");

  // Se recalcula al cambiar el periodo o cuando llegan movimientos nuevos.
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    getStats(business.id, Number(range)).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setStats(res.stats);
        setError(null);
      } else setError(res.message);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, getStats, business.id, range, visits.length, redemptions.length]);

  const s = stats;
  const trend = s && s.visitsPrev ? Math.round(((s.visits - s.visitsPrev) / s.visitsPrev) * 100) : null;
  const busiestHours = s
    ? s.hourly
        .map((value, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value }))
        .filter((x, h) => x.value > 0 || (h >= 8 && h <= 20))
    : [];

  return (
    <RequirePermission allowed={allowed}>
      <PageHeader
        title="Estadísticas"
        description={`Calculadas con todo el historial, en la zona horaria del comercio${s ? "" : "…"}`}
        actions={
          <Segmented<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 días" },
              { value: "30", label: "30 días" },
              { value: "90", label: "90 días" },
            ]}
          />
        }
      />

      {error && <div className="mb-4 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}

      {!s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl bg-black/[0.04]" />
          ))}
        </div>
      ) : (
        <div className={stats?.days === Number(range) ? "" : "opacity-60 transition-opacity"}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Visitas"
              value={formatNumber(s.visits)}
              hint={trend === null ? `${(s.visits / s.days).toFixed(1)} por día` : `${trend >= 0 ? "+" : ""}${trend}% vs. periodo anterior`}
            />
            <StatCard label="Clientes activos" value={s.activeCustomers} hint={`de ${s.totalCustomers} inscritos`} />
            <StatCard label="Clientes que repiten" value={`${pct(s.returningCustomers, s.activeCustomers)}%`} hint={`${s.returningCustomers} con 2+ visitas`} />
            <StatCard label="Nuevos clientes" value={s.newCustomers} />
            <StatCard label="Recompensas emitidas" value={s.rewardsEarned} />
            <StatCard label="Canjes" value={s.redemptions} hint={`Tasa de canje ${pct(s.redemptions, s.rewardsEarned)}%`} />
            <StatCard label="Pendientes de canjear" value={s.rewardsAvailable} hint="Disponibles hoy" />
            <StatCard label="Correcciones" value={s.reversals} hint="Visitas revertidas" />
          </div>

          <Card className="mt-4">
            <CardHeader title="Visitas por día" description="No incluye visitas revertidas" />
            <div className="p-5">
              <BarChart data={s.daily.map((d) => ({ label: dayFmt.format(new Date(d.date)), value: d.value }))} height={200} />
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Por día de la semana" />
              <div className="p-5">
                <HBarList data={WEEKDAYS.map((label, i) => ({ label, value: s.weekday[i] ?? 0 }))} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Por hora" description="Hora local del comercio" />
              <div className="p-5">
                <HBarList data={busiestHours} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Progreso de tarjetas" description={`Clientes según sellos actuales (meta: ${program?.stampsRequired})`} />
              <div className="p-5">
                <HBarList data={s.stampDistribution.map((value, i) => ({ label: `${i} sellos`, value }))} />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Equipo" description="Visitas y canjes registrados por cada persona" />
              {s.byStaff.length === 0 ? (
                <EmptyState icon={BarChart3} title="Sin movimientos en este periodo" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Persona</Th>
                      <Th className="text-right">Visitas</Th>
                      <Th className="text-right">Canjes</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.byStaff.map((p) => (
                      <tr key={p.name}>
                        <Td className="font-medium">{p.name}</Td>
                        <Td className="tabular text-right">{p.visits}</Td>
                        <Td className="tabular text-right">{p.redemptions}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
            <div className="space-y-4">
            {s.byLocation.some((l) => l.name !== "Sin sede") && (
              <Card>
                <CardHeader title="Por sede" />
                <div className="p-5">
                  <HBarList data={s.byLocation.map((l) => ({ label: l.name, value: l.visits }))} />
                </div>
              </Card>
            )}
            <Card className="p-5 text-sm">
              <p className="text-muted">Consentimiento de marketing</p>
              <p className="mt-1 text-2xl font-semibold">{pct(s.marketingConsent, s.totalCustomers)}%</p>
              <p className="text-muted">
                {s.marketingConsent} de {s.totalCustomers} clientes aceptaron recibir comunicaciones.
              </p>
            </Card>
            </div>
          </div>
        </div>
      )}
    </RequirePermission>
  );
}
