"use client";

import Link from "next/link";
import { ArrowUpRight, Gift, Repeat, Sparkles, Users, CalendarCheck } from "lucide-react";
import { onboardingSteps } from "@/components/business/onboarding";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { BarChart, dailySeries } from "@/components/business/charts";
import { Avatar, Badge, ButtonLink, Card, CardHeader, PageHeader, Progress, StatCard } from "@/components/ui";
import { can } from "@/lib/domain/permissions";
import { formatNumber, formatRelative } from "@/lib/utils";

export default function BusinessDashboard() {
  const s = useScope();
  const { business, program, customers, cards, visits, rewards, redemptions, membership } = s;
  const now = new Date();
  const d30 = now.getTime() - 30 * 86400000;
  const d60 = now.getTime() - 60 * 86400000;
  const base = `/business/${business.slug}`;
  const setup = onboardingSteps(s);
  const customerLimitNear = !!s.plan?.maxCustomers && customers.length >= s.plan.maxCustomers * 0.8;

  const realVisits = visits.filter((v) => v.kind === "visit");
  const v30 = realVisits.filter((v) => new Date(v.createdAt).getTime() > d30).length;
  const vPrev = realVisits.filter((v) => {
    const t = new Date(v.createdAt).getTime();
    return t > d60 && t <= d30;
  }).length;
  const newCustomers30 = customers.filter((c) => new Date(c.createdAt).getTime() > d30).length;
  const available = rewards.filter((r) => r.status === "available").length;
  const red30 = redemptions.filter((r) => new Date(r.createdAt).getTime() > d30).length;
  const returning = cards.filter((c) => c.totalVisits >= 2).length;
  const deltaPct = vPrev ? Math.round(((v30 - vPrev) / vPrev) * 100) : 0;

  const series = dailySeries(realVisits.map((v) => v.createdAt), 30, now);
  const required = program?.stampsRequired ?? 1;

  const nearReward = cards
    .filter((c) => c.status !== "blocked" && required - c.currentStamps <= 2 && c.currentStamps > 0)
    .sort((a, b) => b.currentStamps - a.currentStamps)
    .slice(0, 5);

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const profileName = (id: string) => s.profiles.find((p) => p.id === id)?.fullName ?? "—";

  const activity = [
    ...visits.slice(0, 12).map((v) => ({ at: v.createdAt, kind: v.kind, cardId: v.cardId, staff: v.staffId })),
    ...redemptions.slice(0, 6).map((r) => ({ at: r.createdAt, kind: "redemption" as const, cardId: r.cardId, staff: r.staffId })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return (
    <RequirePermission allowed={!!membership && can(membership, "analytics.read")}>
      <PageHeader
        title={`Hola, ${s.actingProfile?.fullName.split(" ")[0]}`}
        description={`Así va ${program?.name ?? "tu programa"} en los últimos 30 días.`}
      />

      {!setup.complete && (
        <Link
          href={`${base}/onboarding`}
          className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm shadow-card hover:bg-canvas"
        >
          <Sparkles className="size-5 shrink-0 text-brand" />
          <span className="flex-1">
            <span className="font-semibold">Termina de configurar tu programa</span>{" "}
            <span className="text-muted">
              · {setup.done} de {setup.total} pasos listos
            </span>
          </span>
          <ArrowUpRight className="size-4 text-muted" />
        </Link>
      )}
      {customerLimitNear && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          Llevas {formatNumber(customers.length)} de {formatNumber(s.plan!.maxCustomers!)} clientes de tu plan {s.plan!.name}. Al llegar al límite no se podrán inscribir
          clientes nuevas: pide un cambio de plan a tiempo.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clientes" value={formatNumber(customers.length)} icon={Users} hint={`+${newCustomers30} este mes`} />
        <StatCard
          label="Visitas (30 días)"
          value={formatNumber(v30)}
          icon={CalendarCheck}
          delta={vPrev ? { value: `${deltaPct >= 0 ? "+" : ""}${deltaPct}%`, positive: deltaPct >= 0 } : undefined}
          hint="vs. 30 días anteriores"
        />
        <StatCard label="Recompensas por canjear" value={available} icon={Gift} hint={`${red30} canjeadas este mes`} />
        <StatCard
          label="Tasa de retorno"
          value={`${customers.length ? Math.round((returning / customers.length) * 100) : 0}%`}
          icon={Repeat}
          hint="Clientes con 2+ visitas"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Visitas por día" description="Últimos 30 días" />
          <div className="p-5">
            <BarChart data={series} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="A punto de ganar"
            description={`Les faltan 1–2 visitas para: ${program?.rewardName}`}
          />
          <ul className="divide-y divide-line">
            {nearReward.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Nadie por ahora.</li>}
            {nearReward.map((c) => {
              const cust = customerById.get(c.customerId)!;
              return (
                <li key={c.id}>
                  <Link href={`${base}/customers/${cust.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                    <Avatar name={cust.fullName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{cust.fullName}</p>
                      <Progress value={(c.currentStamps / required) * 100} className="mt-1.5" />
                    </div>
                    <span className="tabular text-xs font-medium text-muted">
                      {c.currentStamps}/{required}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Actividad reciente"
          action={
            <Link href={`${base}/customers`} className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
              Ver clientes <ArrowUpRight className="size-3.5" />
            </Link>
          }
        />
        <ul className="divide-y divide-line">
          {activity.map((a, i) => {
            const card = cardById.get(a.cardId);
            const cust = card && customerById.get(card.customerId);
            return (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Avatar name={cust?.fullName ?? "?"} className="size-7" />
                <p className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{cust?.fullName}</span>{" "}
                  <span className="text-muted">
                    {a.kind === "visit" ? "sumó una visita" : a.kind === "reversal" ? "— visita revertida" : `canjeó ${program?.rewardName}`}
                  </span>
                </p>
                <span className="hidden sm:block"><Badge tone={a.kind === "visit" ? "neutral" : a.kind === "reversal" ? "warning" : "brand"}>
                  {a.kind === "visit" ? "Visita" : a.kind === "reversal" ? "Reversión" : "Canje"}
                </Badge></span>
                <span className="hidden w-32 truncate text-right text-xs text-muted md:block">{profileName(a.staff)}</span>
                <span className="w-24 text-right text-xs text-subtle">{formatRelative(a.at, now)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </RequirePermission>
  );
}
