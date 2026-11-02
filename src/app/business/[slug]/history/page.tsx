"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Gift, History, Search, ShieldCheck, Stamp, Undo2, UserPlus, type LucideIcon } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { can } from "@/lib/domain/permissions";
import { Button, Card, EmptyState, Input, PageHeader, Segmented, Select } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

type Kind = "visit" | "reversal" | "reward" | "redemption" | "customer";
type Period = "7" | "30" | "90" | "all";
type Tab = "movements" | "audit";

const KINDS: Record<Kind, { label: string; icon: LucideIcon; tone: string }> = {
  visit: { label: "Visita (+1)", icon: Stamp, tone: "bg-black/[0.05] text-ink-2" },
  reversal: { label: "Visita revertida (−1)", icon: Undo2, tone: "bg-warning-bg text-warning" },
  reward: { label: "Recompensa obtenida", icon: Gift, tone: "bg-brand-soft text-brand" },
  redemption: { label: "Recompensa canjeada", icon: ShieldCheck, tone: "bg-success-bg text-success" },
  customer: { label: "Nuevo cliente", icon: UserPlus, tone: "bg-info-bg text-info" },
};

const AUDIT_LABELS: Record<string, string> = {
  "visit.created": "Registró una visita",
  "visit.reversed": "Revirtió una visita",
  "reward.earned": "Se emitió una recompensa",
  "reward.birthday": "Se entregó un regalo de cumpleaños",
  "promotions.insert": "Creó una promoción",
  "promotions.update": "Cambió una promoción",
  "reward.redeemed": "Canjeó una recompensa",
  "customer.registered": "Se inscribió un cliente",
  "customers.exported": "Exportó la lista de clientes",
  "card.blocked": "Bloqueó una tarjeta",
  "card.unblocked": "Reactivó una tarjeta",
  "loyalty_programs.insert": "Creó el programa",
  "loyalty_programs.update": "Cambió el programa",
  "business_memberships.insert": "Añadió a una persona al equipo",
  "business_memberships.update": "Cambió permisos del equipo",
  "business_memberships.delete": "Quitó a una persona del equipo",
  "business.updated": "Cambió los datos del comercio",
  "business.created": "Se creó el comercio",
  "business.active": "La plataforma activó el comercio",
  "business.trial": "La plataforma pasó el comercio a prueba",
  "business.suspended": "La plataforma suspendió el comercio",
  "program.updated": "Cambió el programa",
};

const PAGE = 50;

export default function HistoryPage() {
  const { business, customers, cards, visits, rewards, redemptions, auditLogs, profiles, membership } = useScope();
  const [tab, setTab] = useState<Tab>("movements");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [staff, setStaff] = useState("all");
  const [period, setPeriod] = useState<Period>("30");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const isOwner = membership?.role === "owner";

  const profileName = (id?: string | null) => (id ? profiles.find((p) => p.id === id)?.fullName ?? "Usuario eliminado" : "Cliente (autoservicio)");
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const customerOfCard = useMemo(() => {
    const m = new Map<string, (typeof customers)[number]>();
    for (const c of cards) {
      const cu = customerById.get(c.customerId);
      if (cu) m.set(c.id, cu);
    }
    return m;
  }, [cards, customerById]);

  const all = useMemo(() => {
    const rows: { id: string; kind: Kind; at: string; customerId?: string; staffId?: string; detail?: string }[] = [
      ...visits.map((v) => ({
        id: v.id,
        kind: v.kind as Kind,
        at: v.createdAt,
        customerId: customerOfCard.get(v.cardId)?.id,
        staffId: v.staffId,
        detail: v.reason ? `Motivo: ${v.reason}` : v.bonusStamps ? `+${v.bonusStamps} por promoción` : undefined,
      })),
      ...rewards.map((r) => ({
        id: r.id,
        kind: "reward" as const,
        at: r.earnedAt,
        customerId: customerOfCard.get(r.cardId)?.id,
        detail: r.kind === "birthday" ? `🎂 ${r.name}` : r.name,
      })),
      ...redemptions.map((r) => ({
        id: r.id,
        kind: "redemption" as const,
        at: r.createdAt,
        customerId: customerOfCard.get(r.cardId)?.id,
        staffId: r.staffId,
        detail: rewards.find((x) => x.id === r.rewardId)?.name,
      })),
      ...customers.map((c) => ({ id: c.id, kind: "customer" as const, at: c.createdAt, customerId: c.id })),
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [visits, rewards, redemptions, customers, customerOfCard]);

  const filtered = useMemo(() => {
    const since = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (staff !== "all" && r.staffId !== staff) return false;
      if (new Date(r.at).getTime() < since) return false;
      if (term) {
        const c = r.customerId ? customerById.get(r.customerId) : undefined;
        if (!c || (!c.fullName.toLowerCase().includes(term) && !c.phone.includes(term))) return false;
      }
      return true;
    });
  }, [all, kind, staff, period, q, customerById]);

  const team = profiles.filter((p) => visits.some((v) => v.staffId === p.id) || redemptions.some((r) => r.staffId === p.id));
  const reset = () => setLimit(PAGE);

  return (
    <RequirePermission allowed={!!membership && can(membership, "analytics.read")}>
      <PageHeader
        title="Historial"
        description="Todo lo que pasó en tu programa. Nada se borra: las correcciones aparecen como reversiones con su motivo."
        actions={
          isOwner ? (
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "movements", label: "Movimientos" },
                { value: "audit", label: "Auditoría" },
              ]}
            />
          ) : undefined
        }
      />

      {tab === "movements" ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Cliente o teléfono" className="h-9 pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={kind} onChange={(e) => { setKind(e.target.value as Kind | "all"); reset(); }} className="h-9" aria-label="Tipo de movimiento">
                <option value="all">Todos los tipos</option>
                {Object.entries(KINDS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
              <Select value={staff} onChange={(e) => { setStaff(e.target.value); reset(); }} className="h-9" aria-label="Persona del equipo">
                <option value="all">Todo el equipo</option>
                {team.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
            </div>
            <div className="lg:ml-auto">
              <Segmented<Period>
                value={period}
                onChange={(v) => { setPeriod(v); reset(); }}
                options={[
                  { value: "7", label: "7 d" },
                  { value: "30", label: "30 d" },
                  { value: "90", label: "90 d" },
                  { value: "all", label: "Todo" },
                ]}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={History} title="No hay movimientos con estos filtros" />
          ) : (
            <>
              <p className="border-b border-line px-5 py-2 text-xs text-muted">{filtered.length} movimientos</p>
              <ul className="divide-y divide-line">
                {filtered.slice(0, limit).map((r) => {
                  const k = KINDS[r.kind];
                  const c = r.customerId ? customerById.get(r.customerId) : undefined;
                  return (
                    <li key={`${r.kind}-${r.id}`} className="flex items-start gap-3 px-5 py-3">
                      <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", k.tone)}>
                        <k.icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p>
                          <span className="font-medium">{k.label}</span>
                          {c && (
                            <>
                              {" · "}
                              <Link href={`/business/${business.slug}/customers/${c.id}`} className="hover:underline">
                                {c.fullName}
                              </Link>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDateTime(r.at)}
                          {r.kind !== "reward" && r.kind !== "customer" && ` · ${profileName(r.staffId)}`}
                          {r.detail && r.kind !== "reversal" && ` · ${r.detail}`}
                        </p>
                        {r.kind === "reversal" && r.detail && <p className="mt-0.5 text-xs text-ink-2">{r.detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > limit && (
                <div className="border-t border-line p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                    Ver {Math.min(PAGE, filtered.length - limit)} más
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      ) : (
        <Card>
          <p className="border-b border-line px-5 py-3 text-xs text-muted">
            Registro inalterable de acciones del equipo y cambios de configuración (últimos {auditLogs.length}). Ni siquiera el soporte de la plataforma puede modificarlo.
          </p>
          {auditLogs.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Sin registros todavía" />
          ) : (
            <ul className="divide-y divide-line">
              {auditLogs.slice(0, limit).map((a) => {
                const reason = typeof a.metadata?.reason === "string" ? a.metadata.reason : null;
                const rows = typeof a.metadata?.rows === "number" ? a.metadata.rows : null;
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{AUDIT_LABELS[a.action] ?? a.action}</p>
                      <p className="text-xs text-muted">
                        {profileName(a.actorId)}
                        {reason && ` · Motivo: ${reason}`}
                        {rows !== null && ` · ${rows} clientes`}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {auditLogs.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Ver más
              </Button>
            </div>
          )}
        </Card>
      )}
    </RequirePermission>
  );
}
