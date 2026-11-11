"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Search, Users } from "lucide-react";
import { useData } from "@/lib/data/store";
import { useScope } from "@/components/business/business-shell";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Progress, Segmented, Table, Td, Th } from "@/components/ui";
import { can } from "@/lib/domain/permissions";
import { formatDate, formatRelative } from "@/lib/utils";
import { CARD_STATUS as STATUS_BADGE } from "@/components/business/status";

type Filter = "all" | "reward" | "inactive";


export default function CustomersPage() {
  const router = useRouter();
  const { business, customers, cards, program, membership } = useScope();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { exportCustomers } = useData();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const required = program?.stampsRequired ?? 1;

  const rows = useMemo(() => {
    const now = Date.now();
    const term = q.trim().toLowerCase();
    return customers
      .map((c) => ({ customer: c, card: cards.find((k) => k.customerId === c.id)! }))
      .filter(({ customer, card }) => {
        if (!card) return false;
        if (term && !customer.fullName.toLowerCase().includes(term) && !customer.phone.includes(term) && !(customer.email ?? "").includes(term)) return false;
        if (filter === "reward") return card.status === "reward_available";
        if (filter === "inactive") return !card.lastVisitAt || now - new Date(card.lastVisitAt).getTime() > 45 * 86400000;
        return true;
      })
      .sort((a, b) => (b.card.lastVisitAt ?? "").localeCompare(a.card.lastVisitAt ?? ""));
  }, [customers, cards, q, filter]);

  const download = async () => {
    setExporting(true);
    setExportError(null);
    const res = await exportCustomers(business.id);
    setExporting(false);
    if (!res.ok) return setExportError(res.message);
    const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${business.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${customers.length} clientes inscritos en ${program?.name}.`}
        actions={
          membership && can(membership, "customers.export") ? (
            <Button variant="secondary" onClick={download} disabled={exporting} title="Descarga un CSV con todos los clientes. Queda registrado en la auditoría.">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Exportar CSV
            </Button>
          ) : undefined
        }
      />

      {exportError && <div className="mb-4 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">{exportError}</div>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono o correo" className="h-9 pl-9" />
          </div>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "reward", label: "Con recompensa" },
              { value: "inactive", label: "Inactivos +45d" },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No hay clientes que coincidan" description="Prueba con otro término o filtro." />
        ) : (
          <>
            {/* Tabla escritorio */}
            <Table className="hidden md:block">
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Progreso</Th>
                  <Th>Visitas</Th>
                  <Th>Última visita</Th>
                  <Th>Estado</Th>
                  <Th>Marketing</Th>
                  <Th>Alta</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ customer, card }) => (
                  <tr key={customer.id} onClick={() => router.push(`/business/${business.slug}/customers/${customer.id}`)} className="cursor-pointer hover:bg-canvas">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={customer.fullName} />
                        <div>
                          <p className="font-medium">{customer.fullName}</p>
                          <p className="text-xs text-muted">{customer.phone}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex w-36 items-center gap-2">
                        <Progress value={(card.currentStamps / required) * 100} />
                        <span className="tabular text-xs text-muted">
                          {card.currentStamps}/{required}
                        </span>
                      </div>
                    </Td>
                    <Td className="tabular">{card.totalVisits}</Td>
                    <Td className="text-muted">{formatRelative(card.lastVisitAt)}</Td>
                    <Td>
                      <Badge tone={STATUS_BADGE[card.status].tone} dot>
                        {STATUS_BADGE[card.status].label}
                      </Badge>
                    </Td>
                    <Td className="text-muted">{customer.marketingConsent ? "Sí" : "No"}</Td>
                    <Td className="text-muted">{formatDate(customer.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Lista móvil */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map(({ customer, card }) => (
                <li key={customer.id}>
                  <button onClick={() => router.push(`/business/${business.slug}/customers/${customer.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <Avatar name={customer.fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{customer.fullName}</p>
                        <span className="tabular text-xs text-muted">
                          {card.currentStamps}/{required}
                        </span>
                      </div>
                      <Progress value={(card.currentStamps / required) * 100} className="mt-1.5" />
                      <p className="mt-1 text-xs text-muted">Última visita {formatRelative(card.lastVisitAt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
