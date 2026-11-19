"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { usePlatform } from "@/components/admin/use-platform";
import { BUSINESS_STATUS } from "@/components/business/status";
import { Badge, ButtonLink, Card, Input, PageHeader, Segmented, Table, Td, Th } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessStatus } from "@/lib/domain/types";
import { BrandMark } from "@/components/loyalty/brand-mark";
import { usePuedeEditar } from "@/components/admin/piezas";
import { EtiquetaCobro, useCobros } from "@/components/admin/cobros";
import { estadoCobro, prioridadCobro } from "@/lib/domain/cobros";

export default function BusinessesPage() {
  const router = useRouter();
  const { rows } = usePlatform();
  const puedeEditar = usePuedeEditar();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "cobrar" | BusinessStatus>("all");
  const { fechas, aviso } = useCobros();
  // «Por cobrar»: vencidos o por vencer, sin contar los suspendidos. Primero los más atrasados.
  const porCobrar = (id: string, st: BusinessStatus) => st !== "suspended" && ["vencido", "por-vencer"].includes(estadoCobro(fechas[id]));
  const nPorCobrar = rows.filter((r) => porCobrar(r.business.id, r.business.status)).length;
  const nVencidos = rows.filter((r) => r.business.status !== "suspended" && estadoCobro(fechas[r.business.id]) === "vencido").length;
  const filtered = rows
    .filter(
      (r) =>
        (status === "all" || (status === "cobrar" ? porCobrar(r.business.id, r.business.status) : r.business.status === status)) &&
        (r.business.name + r.business.city + r.business.category).toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => (status === "cobrar" ? prioridadCobro(fechas[a.business.id]) - prioridadCobro(fechas[b.business.id]) : 0));

  return (
    <>
      <PageHeader
        title="Establecimientos"
        description="Todos los comercios de la plataforma. Cada uno tiene sus datos aislados."
        actions={
          puedeEditar ? (
            <ButtonLink href="/admin/businesses/new">
              <Plus className="size-4" /> Nuevo establecimiento
            </ButtonLink>
          ) : undefined
        }
      />
      {aviso && <p className="mb-4 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">{aviso}</p>}
      {nVencidos > 0 && status !== "cobrar" && (
        <button
          type="button"
          onClick={() => setStatus("cobrar")}
          className="mb-4 w-full rounded-lg bg-danger-bg px-4 py-3 text-left text-sm font-medium text-danger hover:brightness-95"
        >
          {nVencidos === 1 ? "1 comercio tiene el pago vencido." : `${nVencidos} comercios tienen el pago vencido.`} Ver por cobrar →
        </button>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio, ciudad o categoría" className="h-9 pl-9" />
          </div>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "trial", label: "Prueba" },
              { value: "suspended", label: "Suspendidos" },
              { value: "cobrar", label: nPorCobrar ? `Por cobrar (${nPorCobrar})` : "Por cobrar" },
            ]}
          />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Comercio</Th>
              <Th>Propietario</Th>
              <Th>Plan</Th>
              <Th>Clientes</Th>
              <Th>Visitas 30d</Th>
              <Th>Alta</Th>
              <Th>Pago</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.business.id} onClick={() => router.push(`/admin/businesses/${r.business.id}`)} className="cursor-pointer hover:bg-canvas">
                <Td>
                  <div className="flex items-center gap-3">
                    <BrandMark branding={r.business.branding} className="size-8 rounded-lg text-[11px] font-semibold text-white" style={{ background: r.business.branding.primary }} />
                    <div>
                      <p className="font-medium">{r.business.name}</p>
                      <p className="text-xs text-muted">
                        {r.business.category} · {r.business.city}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td className="text-muted">{r.owner?.fullName ?? "—"}</Td>
                <Td>{r.plan.name}</Td>
                <Td className="tabular">{formatNumber(r.customers)}</Td>
                <Td className="tabular">{formatNumber(r.visits30d)}</Td>
                <Td className="text-muted">{formatDate(r.business.createdAt)}</Td>
                <Td>{aviso ? <span className="text-muted">—</span> : <EtiquetaCobro pagadoHasta={fechas[r.business.id]} />}</Td>
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
    </>
  );
}
