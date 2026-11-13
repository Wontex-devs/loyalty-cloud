"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Pause, Play } from "lucide-react";
import { usePlatform } from "@/components/admin/use-platform";
import { BUSINESS_STATUS } from "@/components/business/status";
import { useData } from "@/lib/data/store";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { PUBLIC_HOST_LABEL } from "@/lib/config";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, StatCard } from "@/components/ui";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { Store } from "lucide-react";
import { BrandMark } from "@/components/loyalty/brand-mark";
import { DeleteBusiness } from "@/components/admin/delete-business";
import { Aviso, Modal, usePuedeEditar } from "@/components/admin/piezas";

export default function AdminBusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const { rows, state } = usePlatform();
  const { setBusinessStatus, setBusinessPlan } = useData();
  const puedeEditar = usePuedeEditar();
  const [planChoice, setPlanChoice] = useState<string | null>(null);
  const [confirmarEstado, setConfirmarEstado] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [avisoEstado, setAvisoEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const cerrarEstado = useCallback(() => setConfirmarEstado(false), []);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const plans = state.plans;
  const row = rows.find((r) => r.business.id === id);
  if (!row) return <EmptyState icon={Store} title="Establecimiento no encontrado" />;
  const { business: b, plan } = row;
  const planElegido = planChoice ?? b.planId;
  const team = state.memberships.filter((m) => m.businessId === b.id);
  const suspended = b.status === "suspended";

  return (
    <>
      <Link href="/admin/businesses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Establecimientos
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <BrandMark branding={b.branding} className="size-12 rounded-xl font-serif text-lg text-white" style={{ background: b.branding.primary }} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{b.name}</h1>
            <Badge tone={BUSINESS_STATUS[b.status].tone} dot>
              {BUSINESS_STATUS[b.status].label}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            {b.category} · {b.city} · desde {formatDate(b.createdAt)}
          </p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            <Button
              variant={suspended ? "primary" : "secondary"}
              className={suspended ? undefined : "text-danger"}
              onClick={() => {
                setAvisoEstado(null);
                setConfirmarEstado(true);
              }}
            >
              {suspended ? <Play className="size-4" /> : <Pause className="size-4" />}
              {suspended ? "Reactivar" : "Suspender"}
            </Button>
          </div>
        )}
      </div>

      <Modal
        abierto={confirmarEstado}
        onCerrar={cerrarEstado}
        peligro={!suspended}
        titulo={suspended ? `Reactivar ${b.name}` : `Suspender ${b.name}`}
        descripcion={
          suspended
            ? "El comercio vuelve a registrar visitas y a recibir inscripciones."
            : "Mientras esté suspendido no se registran visitas ni inscripciones nuevas. Sus datos se conservan y puedes reactivarlo cuando quieras."
        }
      >
        <div className="space-y-4">
          <Aviso aviso={avisoEstado} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cerrarEstado}>
              Cerrar
            </Button>
            <Button
              data-autofocus
              variant={suspended ? "primary" : "danger"}
              disabled={cambiandoEstado}
              onClick={async () => {
                setCambiandoEstado(true);
                const r = await setBusinessStatus(b.id, suspended ? "active" : "suspended");
                setCambiandoEstado(false);
                if (r.ok) setConfirmarEstado(false);
                else setAvisoEstado({ ok: false, texto: r.message });
              }}
            >
              {cambiandoEstado && <Loader2 className="size-4 animate-spin" />} {suspended ? "Reactivar" : "Suspender comercio"}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clientes" value={formatNumber(row.customers)} hint={plan.maxCustomers ? `Límite del plan: ${formatNumber(plan.maxCustomers)}` : "Sin límite"} />
        <StatCard label="Visitas (30d)" value={formatNumber(row.visits30d)} />
        <StatCard label="Canjes (30d)" value={formatNumber(row.rewards30d)} />
        <StatCard label="Plan" value={plan.name} hint={`${formatMoney(plan.priceMonthly)} / mes`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Datos del establecimiento" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nombre">
              <Input value={b.name} readOnly />
            </Field>
            <Field label="Identificador (slug)" hint={`${PUBLIC_HOST_LABEL}/join/${b.slug}`}>
              <Input value={b.slug} readOnly className="font-mono" />
            </Field>
            <Field label="Categoría">
              <Input value={b.category} readOnly />
            </Field>
            <Field label="Plan" hint="El cambio aplica de inmediato los nuevos límites y queda en la auditoría.">
              <Select value={planElegido} onChange={(e) => setPlanChoice(e.target.value)} disabled={!puedeEditar}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatMoney(p.priceMonthly)}/mes
                  </option>
                ))}
              </Select>
            </Field>
            {puedeEditar && <div className="flex items-center justify-end gap-3 sm:col-span-2">
              {planMsg && <span className={planMsg.ok ? "text-sm text-success" : "text-sm text-danger"}>{planMsg.text}</span>}
              <Button
                variant="secondary"
                disabled={planElegido === b.planId || savingPlan}
                onClick={async () => {
                  setSavingPlan(true);
                  const res = await setBusinessPlan(b.id, planElegido);
                  setSavingPlan(false);
                  setPlanMsg(res.ok ? { ok: true, text: "Plan actualizado." } : { ok: false, text: res.message });
                }}
              >
                Cambiar plan
              </Button>
            </div>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Usuarios del comercio" description={`${team.length} miembros`} />
          <ul className="divide-y divide-line">
            {team.map((m) => {
              const p = state.profiles.find((x) => x.id === m.profileId);
              if (!p) return null;
              return (
                <li key={m.id}>
                  <Link href={`/admin/users/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                    <Avatar name={p.fullName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.fullName}</p>
                      <p className="truncate text-xs text-muted">{p.email}</p>
                    </div>
                    {!m.active && <Badge tone="warning">Desactivado</Badge>}
                    <Badge>{ROLE_LABELS[m.role]}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {puedeEditar && <DeleteBusiness businessId={b.id} slug={b.slug} nombre={b.name} />}
    </>
  );
}
