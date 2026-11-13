"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, LogIn, Store } from "lucide-react";
import type { InicioSesion, UsuarioPanel } from "@/lib/data/admin-queries";
import { cambiarAccesoComercioAction } from "@/lib/data/admin-actions";
import { describirDetalle, estadoCuenta, nombreAccion, ROLES_PLATAFORMA } from "@/lib/domain/acceso";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import type { AuditLog } from "@/lib/domain/types";
import { useData } from "@/lib/data/store";
import { Avatar, Badge, Card, CardHeader, EmptyState, Segmented, Switch } from "@/components/ui";
import { formatDate, formatDateTime, formatRelative } from "@/lib/utils";
import { Aviso, EtiquetaEstado, EtiquetaRol, usePuedeEditar } from "./piezas";
import { UsuarioAcciones } from "./usuario-acciones";

const METODOS: Record<InicioSesion["method"], string> = {
  password: "Contraseña",
  magic_link: "Enlace por correo",
  invite: "Invitación",
  recovery: "Enlace de contraseña",
};

type Pestana = "actividad" | "historial" | "accesos";

export function UsuarioDetalle({
  usuario: u,
  inicios,
  actividad,
  historial,
}: {
  usuario: UsuarioPanel;
  inicios: InicioSesion[];
  actividad: AuditLog[];
  historial: AuditLog[];
}) {
  const { state } = useData();
  const puedeEditar = usePuedeEditar();
  const [pestana, setPestana] = useState<Pestana>("historial");
  const estado = estadoCuenta(u);
  const membresias = state.memberships.filter((m) => m.profileId === u.id);
  const nombreDe = (id: string | null) => (id ? (state.profiles.find((p) => p.id === id)?.fullName ?? "Cuenta eliminada") : "Sistema");
  const comercioDe = (id: string | null) => (id ? state.businesses.find((b) => b.id === id)?.name : undefined);

  const datos: [string, React.ReactNode][] = [
    ["Correo", <span key="c" className="break-all">{u.email}</span>],
    ["Rol de plataforma", ROLES_PLATAFORMA[u.platformRole].nombre],
    ["Alta", formatDate(u.createdAt)],
    [
      "Último acceso",
      u.lastSignInAt
        ? Date.now() - new Date(u.lastSignInAt).getTime() < 7 * 86_400_000
          ? `${formatRelative(u.lastSignInAt)} · ${formatDateTime(u.lastSignInAt)}`
          : formatDateTime(u.lastSignInAt)
        : "Nunca ha entrado",
    ],
    ["Inicios de sesión (30 días)", String(u.logins30d)],
  ];
  if (u.invitedAt && !u.emailConfirmedAt) datos.push(["Invitado el", formatDateTime(u.invitedAt)]);
  if (u.suspendedAt) {
    datos.push(["Suspendida desde", formatDateTime(u.suspendedAt)]);
    datos.push(["Motivo", u.suspendedReason || "Sin motivo escrito"]);
  }

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Usuarios
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={u.fullName} className="size-14 text-base" />
        <div className="min-w-0">
          <h1 className="truncate font-[family-name:var(--font-poster)] text-2xl font-extrabold tracking-[-0.02em] text-coal sm:text-[32px] sm:leading-tight">{u.fullName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <EtiquetaEstado estado={estado} />
            <EtiquetaRol rol={u.platformRole} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Perfil" />
            <dl className="divide-y divide-line">
              {datos.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[200px_1fr] sm:gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Acceso a comercios" description="Su rol en cada comercio. El propietario no se cambia desde aquí." />
            {membresias.length === 0 ? (
              <EmptyState icon={Store} title="No pertenece a ningún comercio" />
            ) : (
              <ul className="divide-y divide-line">
                {membresias.map((m) => (
                  <AccesoComercio
                    key={m.id}
                    membershipId={m.id}
                    comercio={comercioDe(m.businessId) ?? "Comercio"}
                    businessId={m.businessId}
                    rol={m.role}
                    activo={m.active}
                    canjea={m.canRedeem}
                    editable={puedeEditar && !u.suspendedAt}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-ink">Registro</h3>
              <Segmented<Pestana>
                value={pestana}
                onChange={setPestana}
                options={[
                  { value: "historial", label: `Cambios (${historial.length})` },
                  { value: "actividad", label: `Lo que hizo (${actividad.length})` },
                  { value: "accesos", label: `Accesos (${inicios.length})` },
                ]}
              />
            </div>
            {pestana === "accesos" ? (
              inicios.length === 0 ? (
                <EmptyState icon={LogIn} title="Sin inicios de sesión registrados" description="El registro empezó con esta versión del panel; los accesos anteriores no aparecen aquí." />
              ) : (
                <ul className="divide-y divide-line">
                  {inicios.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                      <span>{METODOS[i.method]}</span>
                      <span className="text-muted tabular">{formatDateTime(i.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ListaAuditoria
                filas={pestana === "historial" ? historial : actividad}
                vacio={pestana === "historial" ? "Nadie ha cambiado esta cuenta todavía." : "No ha hecho cambios registrados."}
                nombreDe={nombreDe}
                comercioDe={comercioDe}
                mostrarActor={pestana === "historial"}
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Acciones" />
            <div className="p-4">
              {puedeEditar ? (
                <UsuarioAcciones usuario={u} esMiCuenta={u.id === state.actingProfileId} />
              ) : (
                <p className="text-[13px] text-muted">Con el rol de Soporte puedes ver esta cuenta, pero no cambiarla.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function ListaAuditoria({
  filas,
  vacio,
  nombreDe,
  comercioDe,
  mostrarActor,
}: {
  filas: AuditLog[];
  vacio: string;
  nombreDe: (id: string | null) => string;
  comercioDe: (id: string | null) => string | undefined;
  mostrarActor: boolean;
}) {
  if (!filas.length) return <EmptyState icon={History} title={vacio} />;
  return (
    <ul className="divide-y divide-line">
      {filas.map((a) => {
        const comercio = comercioDe(a.businessId);
        const detalle = describirDetalle(a);
        return (
          <li key={a.id} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="font-medium text-ink">{nombreAccion(a.action)}</span>
              <span className="text-xs text-muted tabular">{formatDateTime(a.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              {mostrarActor && <>Por {nombreDe(a.actorId)}</>}
              {mostrarActor && comercio && " · "}
              {comercio}
              {detalle && <span className="block text-ink-2">{detalle}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function AccesoComercio({
  membershipId,
  comercio,
  businessId,
  rol,
  activo,
  canjea,
  editable,
}: {
  membershipId: string;
  comercio: string;
  businessId: string;
  rol: "owner" | "admin" | "staff";
  activo: boolean;
  canjea: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const cambiar = async (cambio: Parameters<typeof cambiarAccesoComercioAction>[1]) => {
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await cambiarAccesoComercioAction(membershipId, cambio);
      if (r.ok) router.refresh();
      else setAviso({ ok: false, texto: r.message });
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setTrabajando(false);
    }
  };
  const esDueno = rol === "owner";
  return (
    <li className="px-5 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href={`/admin/businesses/${businessId}`} className="font-medium text-ink hover:text-cobalt">
            {comercio}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={esDueno ? "brand" : "neutral"}>{ROLE_LABELS[rol]}</Badge>
            {!activo && <Badge tone="warning">Desactivado</Badge>}
            {rol === "staff" && canjea && <Badge tone="info">Canjea premios</Badge>}
          </div>
        </div>
        {editable && !esDueno && (
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <select
              value={rol}
              disabled={trabajando}
              onChange={(e) => void cambiar({ role: e.target.value as "admin" | "staff" })}
              aria-label={`Rol en ${comercio}`}
              className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px]"
            >
              <option value="admin">{ROLE_LABELS.admin}</option>
              <option value="staff">{ROLE_LABELS.staff}</option>
            </select>
            {rol === "staff" && (
              <label className="flex items-center gap-1.5 text-ink-2">
                <input type="checkbox" checked={canjea} disabled={trabajando} onChange={(e) => void cambiar({ canRedeem: e.target.checked })} className="size-4 accent-cobalt" />
                Canjea
              </label>
            )}
            <Switch checked={activo} onChange={(v) => void cambiar({ active: v })} label={activo ? "Activo" : "Inactivo"} />
          </div>
        )}
      </div>
      {aviso && (
        <div className="mt-2">
          <Aviso aviso={aviso} />
        </div>
      )}
    </li>
  );
}
