"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, CalendarDays, Crown, MessageCircle, Printer, Snowflake, Sparkles } from "lucide-react";
import { RequirePermission, useScope } from "@/components/business/business-shell";
import { can } from "@/lib/domain/permissions";
import { change, monthLabel, monthlyReport, reportHighlights, reportMonths, reportText } from "@/lib/domain/reporte";
import { Button, Card, CardHeader, PageHeader, Select, StatCard } from "@/components/ui";
import { formatNumber, formatRelative } from "@/lib/utils";

const meses = (m: string) => monthLabel(m).replace(/^./, (c) => c.toUpperCase());

/** Reporte del mes para el dueño: lo importante en un minuto, para leer, imprimir o compartir. */
export default function ReportePage() {
  const scope = useScope();
  const { business, membership, customers, cards, visits, rewards, redemptions, walletNotices } = scope;
  const allowed = !!membership && can(membership, "analytics.read");
  const opciones = useMemo(() => reportMonths(business.createdAt, business.timezone), [business.createdAt, business.timezone]);
  // Por defecto, el último mes completo (si el comercio ya tiene uno); si no, el actual.
  const [month, setMonth] = useState(opciones[1] ?? opciones[0]);
  const r = useMemo(
    () => monthlyReport({ customers, cards, visits, rewards, redemptions, walletNotices }, month, business.timezone),
    [customers, cards, visits, rewards, redemptions, walletNotices, month, business.timezone],
  );
  const frases = reportHighlights(r);
  // En el mes en curso no se compara: medio mes contra un mes completo engaña.
  const delta = (cur: number, prev: number) => {
    if (r.partial) return undefined;
    const c = change(cur, prev);
    return c ? { value: `${c} vs. mes anterior`, positive: cur >= prev } : undefined;
  };
  const compartir = () => window.open(`https://wa.me/?text=${encodeURIComponent(reportText(r, business.name))}`, "_blank", "noopener");

  return (
    <RequirePermission allowed={allowed}>
      {/* Al imprimir solo sale el reporte (sin el menú del panel). */}
      <style>{`@media print{body *{visibility:hidden}#reporte-mes,#reporte-mes *{visibility:visible}#reporte-mes{position:absolute;inset:0 auto auto 0;width:100%;padding:16px}.no-print{display:none!important}}`}</style>
      <div className="no-print">
        <PageHeader
          title="Reporte del mes"
          description="Cómo le fue a tu negocio, en un minuto. Guárdalo en PDF o compártelo con tu socio."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Mes del reporte" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto">
                {opciones.map((m, i) => (
                  <option key={m} value={m}>
                    {meses(m)}
                    {i === 0 ? " (en curso)" : ""}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="size-4" /> PDF
              </Button>
              <Button onClick={compartir}>
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
            </div>
          }
        />
      </div>

      <div id="reporte-mes" className="space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <CalendarDays className="size-4" />
            {business.name} · {meses(r.month)}
            {r.partial && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">en curso</span>}
          </div>
          <ul className="mt-3 space-y-1.5">
            {frases.map((f) => (
              <li key={f} className="flex gap-2 text-[15px] leading-snug">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-cobalt" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Visitas" value={formatNumber(r.visits)} delta={delta(r.visits, r.prevVisits)} hint={r.partial ? "Mes en curso: se compara al cerrar" : r.prevVisits ? undefined : "Sin visitas el mes anterior"} />
          <StatCard label="Clientes que vinieron" value={r.activeCustomers} delta={delta(r.activeCustomers, r.prevActiveCustomers)} />
          <StatCard label="Clientes nuevos" value={r.newCustomers} delta={delta(r.newCustomers, r.prevNewCustomers)} />
          <StatCard label="Premios entregados" value={r.redemptions} delta={delta(r.redemptions, r.prevRedemptions)} hint={`${r.rewardsEarned} ${r.rewardsEarned === 1 ? "ganado" : "ganados"} en el mes`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Tus mejores clientes" description="Los que más vinieron en el mes. Un detalle con ellos vale oro." />
            {r.topCustomers.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nadie vino este mes todavía.</p>
            ) : (
              <ol className="divide-y divide-line">
                {r.topCustomers.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs font-semibold">
                      {i === 0 ? <Crown className="size-3.5 text-[#B8860B]" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="text-muted">
                      {c.visits} {c.visits === 1 ? "visita" : "visitas"} · {c.stamps} sellos
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Se están enfriando"
              description={
                r.coolingCount
                  ? `${r.coolingCount} ${r.coolingCount === 1 ? "cliente vino" : "clientes vinieron"} el mes anterior y ${r.partial ? "aún no" : "no"} ${r.coolingCount === 1 ? "ha" : "han"} vuelto.`
                  : "Todos los que vinieron el mes anterior volvieron. ¡Muy bien!"
              }
            />
            {r.cooling.length > 0 && (
              <>
                <ul className="divide-y divide-line">
                  {r.cooling.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <Snowflake className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      <span className="text-muted">
                        {c.stamps} sellos{c.lastVisitAt ? ` · ${formatRelative(c.lastVisitAt)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="no-print border-t border-line px-5 py-3">
                  <Link href={`/business/${business.slug}/campaigns`} className="text-sm font-medium text-cobalt hover:underline">
                    Enviarles un aviso →
                  </Link>
                </div>
              </>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Recordatorios automáticos</p>
              {r.remindersSent ? (
                <p className="mt-0.5 text-muted">
                  Se enviaron {r.remindersSent} y <strong className="font-semibold text-success">{r.remindersReturned} {r.remindersReturned === 1 ? "cliente volvió" : "clientes volvieron"}</strong>{" "}
                  después del aviso ({Math.round((r.remindersReturned / r.remindersSent) * 100)} %).
                </p>
              ) : (
                <p className="mt-0.5 text-muted">
                  Este mes no salió ninguno. Salen solos a quien está cerca del premio o lleva días sin venir.{" "}
                  <Link href={`/business/${business.slug}/campaigns`} className="no-print font-medium text-cobalt hover:underline">
                    Revisar ajustes
                  </Link>
                </p>
              )}
            </div>
          </div>
        </Card>
        <p className="text-center text-xs text-subtle">Reporte hecho con Lazo · {meses(r.month)}{r.partial ? " (parcial)" : ""}</p>
      </div>
    </RequirePermission>
  );
}
