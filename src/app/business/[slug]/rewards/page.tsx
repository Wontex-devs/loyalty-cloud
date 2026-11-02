"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Loader2, ShieldCheck } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { REWARD_STATUS } from "@/components/business/status";
import { useDemo } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Segmented, StatCard, Table, Td, Th } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

type Tab = "available" | "redeemed" | "closed" | "all";

export default function RewardsPage() {
  const { business, program, rewards, redemptions, customers, cards, membership, profiles } = useScope();
  const { redeemReward } = useDemo();
  const [tab, setTab] = useState<Tab>("available");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const canRedeem = !!membership && can(membership, "rewards.redeem");

  const redemptionByReward = new Map(redemptions.map((r) => [r.rewardId, r]));
  const customerOfCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    return customers.find((c) => c.id === card?.customerId);
  };
  const rows = rewards
    .filter((r) => tab === "all" || (tab === "closed" ? r.status === "expired" || r.status === "void" : r.status === tab))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));

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
        <div className="border-b border-line p-3">
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
          <EmptyState icon={Gift} title="No hay recompensas en esta vista" />
        ) : (
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
                    <Td className="text-right">
                      {r.status === "available" &&
                        (!canRedeem ? (
                          <span className="text-xs text-subtle">Sin permiso</span>
                        ) : confirming === r.id ? (
                          <span className="inline-flex gap-1.5">
                            <Button
                              size="sm"
                              variant="brand"
                              disabled={saving === r.id}
                              onClick={async () => {
                                setSaving(r.id);
                                const res = await redeemReward(r.id);
                                setSaving(null);
                                setConfirming(null);
                                setFlash(res.ok ? { ok: true, text: `Canje registrado: ${r.name} para ${cust?.fullName}.` } : { ok: false, text: res.message });
                              }}
                            >
                              {saving === r.id ? <Loader2 className="size-3.5 animate-spin" /> : null} Confirmar
                            </Button>
                            <Button size="sm" variant="ghost" disabled={saving === r.id} onClick={() => setConfirming(null)}>
                              Cancelar
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setConfirming(r.id)}>
                            Canjear
                          </Button>
                        ))}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
