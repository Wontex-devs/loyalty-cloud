"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, MessageCircle, Search, Users } from "lucide-react";
import { useData } from "@/lib/data/store";
import { useScope } from "@/components/business/business-shell";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Progress, Segmented, Table, Td, Th } from "@/components/ui";
import { can } from "@/lib/domain/permissions";
import { formatDate, formatRelative } from "@/lib/utils";
import { CARD_STATUS as STATUS_BADGE } from "@/components/business/status";
import { useWalletStatus, WalletBadge, walletsOf } from "@/components/business/wallet-status";
import { cardMessage, whatsappUrl } from "@/lib/wallet/invite";
import { greetingName } from "@/lib/wallet/messages";
import { publicOrigin } from "@/lib/config";

type Filter = "all" | "reward" | "inactive" | "nowallet";


export default function CustomersPage() {
  const router = useRouter();
  const { business, customers, cards, program, membership } = useScope();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { exportCustomers } = useData();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const required = program?.stampsRequired ?? 1;
  const wallet = useWalletStatus(business.id);

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
        if (filter === "nowallet") return walletsOf(wallet, card.id)?.length === 0 && !customer.anonymizedAt;
        return true;
      })
      .sort((a, b) => (b.card.lastVisitAt ?? "").localeCompare(a.card.lastVisitAt ?? ""));
  }, [customers, cards, q, filter, wallet]);

  const withCard = customers.filter((c) => !c.anonymizedAt && cards.some((k) => k.customerId === c.id));
  const saved = withCard.filter((c) => (walletsOf(wallet, cards.find((k) => k.customerId === c.id)!.id) ?? []).length > 0).length;
  /** WhatsApp con la invitación a guardar la tarjeta (solo si no la tiene en la billetera). */
  const invite = (customer: (typeof customers)[number], card: (typeof cards)[number]) => {
    const w = walletsOf(wallet, card.id);
    if (!w || w.length || !customer.phone || customer.anonymizedAt || card.status === "blocked") return null;
    const url = whatsappUrl(customer.phone, cardMessage(greetingName(customer), business.name, `${publicOrigin()}/card/${card.publicToken}`, false));
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener"
        onClick={(e) => e.stopPropagation()}
        title="Abre WhatsApp con un mensaje que lo invita a guardar la tarjeta en su billetera"
        className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-ink-2 hover:bg-canvas"
      >
        <MessageCircle className="size-3.5" /> Invitar
      </a>
    );
  };

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

      {!wallet.loading && wallet.ok && withCard.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold">{saved} de {withCard.length}</span> clientes tienen la tarjeta guardada en la billetera del celular.
            <span className="text-muted"> Solo a ellos les llegan los avisos de sellos, premios, promociones y cercanía.</span>
            {!wallet.googleChecked && <span className="text-muted"> (Por ahora solo se cuenta Apple Wallet.)</span>}
          </p>
          {saved < withCard.length && filter !== "nowallet" && (
            <button onClick={() => setFilter("nowallet")} className="shrink-0 text-left font-medium text-cobalt hover:underline">
              Ver quién no la tiene
            </button>
          )}
        </div>
      )}

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
              { value: "nowallet", label: "Sin billetera" },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No hay clientes que coincidan" description="Prueba con otro término o filtro." />
        ) : (
          <>
            {/* Tabla escritorio */}
            <Table className="hidden lg:block">
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Progreso</Th>
                  <Th>Visitas</Th>
                  <Th>Última visita</Th>
                  <Th>Estado</Th>
                  <Th>Billetera</Th>
                  <Th className="hidden xl:table-cell">Marketing</Th>
                  <Th className="hidden xl:table-cell">Alta</Th>
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
                    <Td>
                      <div className="flex items-center gap-2">
                        <WalletBadge fallo={!wallet.loading && !wallet.ok} wallets={customer.anonymizedAt ? [] : walletsOf(wallet, card.id)} />
                        {invite(customer, card)}
                      </div>
                    </Td>
                    <Td className="hidden text-muted xl:table-cell">{customer.marketingConsent ? "Sí" : "No"}</Td>
                    <Td className="hidden text-muted xl:table-cell">{formatDate(customer.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Lista en celular y tableta */}
            <ul className="divide-y divide-line lg:hidden">
              {rows.map(({ customer, card }) => (
                <li key={customer.id} className="relative">
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
                      <WalletBadge fallo={!wallet.loading && !wallet.ok} wallets={customer.anonymizedAt ? [] : walletsOf(wallet, card.id)} className="mt-1.5" />
                    </div>
                  </button>
                  {invite(customer, card) && <div className="absolute right-4 bottom-3">{invite(customer, card)}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
