"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarCheck, Plus, Store, Users, Wallet } from "lucide-react";
import { usePlatform } from "@/components/admin/use-platform";
import { HBarList } from "@/components/business/charts";
import { BUSINESS_STATUS } from "@/components/business/status";
import { Badge, ButtonLink, Card, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/utils";

export default function AdminDashboard() {
  const { rows, mrr, state } = usePlatform();
  const active = rows.filter((r) => r.business.status === "active").length;
  const totalCustomers = rows.reduce((s, r) => s + r.customers, 0);
  const totalVisits = rows.reduce((s, r) => s + r.visits30d, 0);
  const top = [...rows].sort((a, b) => b.visits30d - a.visits30d).slice(0, 5);
  const platformLogs = state.auditLogs.filter((a) => a.businessId === null).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Resumen de la plataforma"
        description="Indicadores generales de todos los establecimientos."
        actions={
          <ButtonLink href="/admin/businesses/new">
            <Plus className="size-4" /> Nuevo establecimiento
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Establecimientos activos" value={active} icon={Store} hint={`${rows.length} en total`} />
        <StatCard label="MRR estimado" value={formatMoney(mrr)} icon={Wallet} hint="Planes activos" />
        <StatCard label="Clientes finales" value={formatNumber(totalCustomers)} icon={Users} />
        <StatCard label="Visitas (30 días)" value={formatNumber(totalVisits)} icon={CalendarCheck} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Establecimientos con más actividad"
            action={
              <Link href="/admin/businesses" className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
                Ver todos <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Comercio</Th>
                <Th>Plan</Th>
                <Th>Clientes</Th>
                <Th>Visitas 30d</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.business.id} className="hover:bg-canvas">
                  <Td>
                    <Link href={`/admin/businesses/${r.business.id}`} className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-md text-[11px] font-semibold" style={{ background: r.business.branding.primary, color: "#fff" }}>
                        {r.business.branding.logoText}
                      </span>
                      <span className="font-medium">{r.business.name}</span>
                    </Link>
                  </Td>
                  <Td className="text-muted">{r.plan.name}</Td>
                  <Td className="tabular">{formatNumber(r.customers)}</Td>
                  <Td className="tabular">{formatNumber(r.visits30d)}</Td>
                  <Td>
                    <Badge tone={BUSINESS_STATUS[r.business.status].tone} dot>
                      {BUSINESS_STATUS[r.business.status].label}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Distribución por plan" />
          <div className="p-5">
            <HBarList data={state.plans.map((p) => ({ label: p.name, value: rows.filter((r) => r.plan.id === p.id).length }))} />
          </div>
          <div className="border-t border-line p-5">
            <p className="mb-3 text-sm font-semibold">Actividad de plataforma</p>
            <ul className="space-y-2.5">
              {platformLogs.map((a) => (
                <li key={a.id} className="text-[13px]">
                  <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px]">{a.action}</code>{" "}
                  <span className="text-muted">{state.businesses.find((b) => b.id === a.entityId)?.name}</span>
                  <p className="mt-0.5 text-xs text-subtle">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
