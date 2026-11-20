"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Loader2, Search, ShieldCheck } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { REWARD_STATUS } from "@/components/business/status";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, StatCard, Table, Td, Th } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

type Tab = "available" | "redeemed" | "closed" | "all";

export default function RewardsPage() {
  const { business, program, rewards, redemptions, customers, cards, membership, profiles } = useScope();
  const { redeemReward } = useData();
  const [tab, setTab] = useState<Tab>("available");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const canRedeem = !!membership && can(membership, "rewards.redeem");

  const redemptionByReward = new Map(redemptions.map((r) => [r.rewardId, r]));
  const customerOfCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    return customers.find((c) => c.id === card?.customerId);
  };
  // Búsqueda por nombre o por los últimos dígitos del celular.
  const buscado = q.trim().toLowerCase();
  const digitos = buscado.replace(/\D/g, "");
  const coincide = (cardId: string) => {
    if (!buscado) return true;
    const c = customerOfCard(cardId);
    if (!c) return false;
    return c.fullName.toLowerCase().includes(buscado) || (digitos.length >= 3 && c.phone.replace(/\D/g, "").includes(digitos));
  };
  const rows = rewards
    .filter((r) => (tab === "all" || (tab === "closed" ? r.status === "expired" || r.status === "void" : r.status === tab)) && coincide(r.cardId))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));

  const canjear = async (id: string, nombre: string, cliente?: string) => {
    setSaving(id);
    const res = await redeemReward(id);
    setSaving(null);
    setConfirming(null);
    setFlash(res.ok ? { ok: true, text: `Canje registrado: ${nombre}${cliente ? ` para ${cliente}` : ""}.` } : { ok: false, text: res.message });
  };

  /** Botón de canje con confirmación (mismo en la tabla y en la lista del celular). */
  const controlCanje = ({ id, nombre, cliente, grande }: { id: string; nombre: string; cliente?: string; grande?: boolean }) =>
    !canRedeem ? (
      <span className="text-xs text-subtle">Sin permiso para canjear</span>
    ) : confirming === id ? (
      <span className="inline-flex gap-1.5">
        <Button size={grande ? "lg" : "sm"} variant="brand" disabled={saving === id} onClick={() => void canjear(id, nombre, cliente)}>
          {saving === id ? <Loader2 className="size-3.5 animate-spin" /> : null} Confirmar
        </Button>
        <Button size={grande ? "lg" : "sm"} variant="ghost" disabled={saving === id} onClick={() => setConfirming(null)}>
          Cancelar
        </Button>
      </span>
    ) : (
      <Button size={grande ? "lg" : "sm"} variant="secondary" onClick={() => setConfirming(id)}>
        <Gift className="size-4" /> Canjear
      </Button>
    );

  const d30 = Date.now() - 30 * 86400000;

  return (
    <>
      <PageHeader title="Recompensas" description={`Recompensa del programa: ${program?.rewardName} al completar ${program?.stampsRequired} visitas.`} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Disponibles" value={rewards.filter((r) => r.status === "available").length} icon={Gift} />
        <StatCard label="Canjeadas (30 días)" value={redemptions.filter((r) => new Date(r.createdAt).getTime() > d30).length} icon={ShieldCheck} />
        <StatCard label="Total emitidas" value={rewards.length} hint="Desde el inicio del programa" />
      </div>

      {flash && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${flash.ok ? "border-success/20 bg-success-bg text-success" : "border-danger/20 bg-danger-bg text-danger"}`}>{flash.text}</div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o celular" className="pl-9" type="search" />
          </div>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "available", label: "Disponibles" },
              { value: "redeemed", label: "Canjeadas" },
              { value: "closed", label: "Vencidas o anuladas" },
              { value: "all", label: "Todas" },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Gift} title={buscado ? "Nadie coincide con la búsqueda" : "No hay recompensas en esta vista"} />
        ) : (
          <>
            {/* Celular: una tarjeta por premio, con el botón grande. */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((r) => {
              const cust = customerOfCard(r.cardId);
              const red = redemptionByReward.get(r.id);
              return (
                <li key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={cust?.fullName ?? "?"} className="size-9" />
                    <div className="min-w-0 flex-1">
                      {cust ? (
                        <Link href={`/business/${business.slug}/customers/${cust.id}`} className="block truncate font-medium hover:underline">
                          {cust.fullName}
                        </Link>
                      ) : (
                        <span className="text-muted">Cliente</span>
                      )}
                      <p className="text-sm">{r.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        Obtenida {formatDate(r.earnedAt)}
                        {r.expiresAt ? ` · vence ${formatDate(r.expiresAt)}` : ""}
                      </p>
                      {red && <p className="mt-0.5 text-xs text-muted">Canjeada {formatDateTime(red.createdAt)}</p>}
                    </div>
                    <Badge tone={REWARD_STATUS[r.status].tone} dot>
                      {REWARD_STATUS[r.status].label}
                    </Badge>
                  </div>
                  {r.status === "available" && (
                    <div className="mt-3">
                      {controlCanje({ id: r.id, nombre: r.name, cliente: cust?.fullName, grande: true })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Recompensa</Th>
                <Th>Obtenida</Th>
                <Th>Vence</Th>
                <Th>Estado</Th>
                <Th>Canje</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cust = customerOfCard(r.cardId);
                const red = redemptionByReward.get(r.id);
                return (
                  <tr key={r.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={cust?.fullName ?? "?"} className="size-7" />
                        {cust ? (
                          <Link href={`/business/${business.slug}/customers/${cust.id}`} className="font-medium hover:underline">
                            {cust.fullName}
                          </Link>
                        ) : (
                          <span className="text-muted">Cliente</span>
                        )}
                      </div>
                    </Td>
                    <Td>{r.name}</Td>
                    <Td className="text-muted">{formatDate(r.earnedAt)}</Td>
                    <Td className="text-muted">{formatDate(r.expiresAt)}</Td>
                    <Td>
                      <Badge tone={REWARD_STATUS[r.status].tone} dot>
                        {REWARD_STATUS[r.status].label}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-muted">{red ? `${formatDateTime(red.createdAt)} · ${profiles.find((p) => p.id === red.staffId)?.fullName}` : "—"}</Td>
                    <Td className="text-right">{r.status === "available" && controlCanje({ id: r.id, nombre: r.name, cliente: cust?.fullName })}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          </div>
          </>
        )}
      </Card>
    </>
  );
}
