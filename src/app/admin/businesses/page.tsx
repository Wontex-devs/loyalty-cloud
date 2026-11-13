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

export default function BusinessesPage() {
  const router = useRouter();
  const { rows } = usePlatform();
  const puedeEditar = usePuedeEditar();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | BusinessStatus>("all");
  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.business.status === status) &&
      (r.business.name + r.business.city + r.business.category).toLowerCase().includes(q.toLowerCase()),
  );

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
