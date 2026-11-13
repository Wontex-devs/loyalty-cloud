"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarCheck, CheckCircle2, Clock, Plus, ScrollText, ShieldCheck, Store, UserCheck, Users, UserX, Wallet } from "lucide-react";
import { usePlatform } from "@/components/admin/use-platform";
import { BarChart, dailySeries } from "@/components/business/charts";
import { BUSINESS_STATUS } from "@/components/business/status";
import { BrandMark } from "@/components/loyalty/brand-mark";
import type { InicioSesion, UsuarioPanel } from "@/lib/data/admin-queries";
import { estadoCuenta, nombreAccion } from "@/lib/domain/acceso";
import { Badge, ButtonLink, Card, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { formatMoney, formatNumber, formatRelative } from "@/lib/utils";
import { usePuedeEditar } from "./piezas";
import { InvitarUsuario } from "./invitar-usuario";

const DIA = 86_400_000;

interface Alerta {
  tono: "danger" | "warning" | "info";
  texto: string;
  href: string;
}

export function Resumen({ usuarios, inicios, aviso }: { usuarios: UsuarioPanel[]; inicios: InicioSesion[]; aviso: string | null }) {
  const { rows, mrr, state } = usePlatform();
  const puedeEditar = usePuedeEditar();
  const ahora = Date.now();

  // ---- Usuarios ----
  const estados = usuarios.map((u) => ({ u, e: estadoCuenta(u, ahora) }));
  const activos = estados.filter((x) => x.e === "activa").length;
  const pendientes = estados.filter((x) => x.e === "pendiente");
  const suspendidos = estados.filter((x) => x.e === "suspendida").length;
  const nuevos30 = usuarios.filter((u) => ahora - new Date(u.createdAt).getTime() <= 30 * DIA).length;
  const nuevos30Previos = usuarios.filter((u) => {
    const t = ahora - new Date(u.createdAt).getTime();
    return t > 30 * DIA && t <= 60 * DIA;
  }).length;

  // ---- Comercios ----
  const comerciosActivos = rows.filter((r) => r.business.status === "active").length;
  const totalClientes = rows.reduce((s, r) => s + r.customers, 0);
  const totalVisitas = rows.reduce((s, r) => s + r.visits30d, 0);
  const top = [...rows].sort((a, b) => b.visits30d - a.visits30d).slice(0, 5);

  // ---- Alertas reales (todas llevan a donde se resuelven) ----
  const alertas: Alerta[] = [];
  const superActivos = usuarios.filter((u) => u.platformRole === "superadmin" && !u.suspendedAt).length;
  if (!aviso && superActivos === 1) alertas.push({ tono: "warning", texto: "Solo hay un superadministrador activo. Si pierde el acceso, nadie podrá administrar la plataforma.", href: "/admin/users" });
  const pendientesViejas = pendientes.filter(({ u }) => u.invitedAt && ahora - new Date(u.invitedAt).getTime() > 7 * DIA).length;
  if (pendientesViejas) alertas.push({ tono: "info", texto: `${pendientesViejas} ${pendientesViejas === 1 ? "invitación lleva" : "invitaciones llevan"} más de 7 días sin aceptarse.`, href: "/admin/users" });
  const sinDueno = state.businesses.filter((b) => !state.memberships.some((m) => m.businessId === b.id && m.role === "owner"));
  if (sinDueno.length) alertas.push({ tono: "danger", texto: `${sinDueno.length} ${sinDueno.length === 1 ? "comercio no tiene" : "comercios no tienen"} propietario: ${sinDueno.map((b) => b.name).join(", ")}.`, href: `/admin/businesses/${sinDueno[0].id}` });
  const suspendidosComercios = state.businesses.filter((b) => b.status === "suspended").length;
  if (suspendidosComercios) alertas.push({ tono: "warning", texto: `${suspendidosComercios} ${suspendidosComercios === 1 ? "comercio está suspendido" : "comercios están suspendidos"}.`, href: "/admin/businesses" });
  if (suspendidos) alertas.push({ tono: "info", texto: `${suspendidos} ${suspendidos === 1 ? "cuenta suspendida" : "cuentas suspendidas"}.`, href: "/admin/users" });

  // ---- Crecimiento por mes (últimos 6) ----
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return { clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, nombre: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(d) };
  });
  const porMes = (fechas: string[]) => meses.map((m) => fechas.filter((f) => f.startsWith(m.clave)).length);
  const usuariosMes = porMes(usuarios.map((u) => u.createdAt));
  const comerciosMes = porMes(state.businesses.map((b) => b.createdAt));

  const nombreDe = (id: string | null) => (id ? (state.profiles.find((p) => p.id === id)?.fullName ?? "Cuenta eliminada") : "Sistema");
  const recientes = state.auditLogs.slice(0, 7);
  const delta = nuevos30 - nuevos30Previos;

  return (
    <>
      <PageHeader
        title="Resumen de la plataforma"
        description="Usuarios, comercios y actividad de toda la plataforma, sin datos personales de los clientes."
        actions={
          puedeEditar ? (
            <>
              <ButtonLink href="/admin/businesses/new" variant="secondary">
                <Plus className="size-4" /> Nuevo establecimiento
              </ButtonLink>
              <InvitarUsuario />
            </>
          ) : undefined
        }
      />

      {aviso && (
        <Card className="mb-4 flex items-start gap-3 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>{aviso}</p>
        </Card>
      )}

      <h2 className="mb-2 text-[13px] font-medium text-muted">Usuarios del panel</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Usuarios registrados"
          value={formatNumber(usuarios.length)}
          icon={Users}
          hint={`${nuevos30} nuevos en 30 días`}
          delta={nuevos30Previos || nuevos30 ? { value: `${delta >= 0 ? "+" : ""}${delta} vs. mes anterior`, positive: delta >= 0 } : undefined}
        />
        <StatCard label="Activos" value={formatNumber(activos)} icon={UserCheck} hint={usuarios.length ? `${Math.round((activos / usuarios.length) * 100)}% entró en 30 días` : undefined} />
        <StatCard label="Invitaciones pendientes" value={formatNumber(pendientes.length)} icon={Clock} hint="Aún sin crear contraseña" />
        <StatCard label="Suspendidos" value={formatNumber(suspendidos)} icon={UserX} hint="Sin acceso" />
      </div>

      <h2 className="mt-6 mb-2 text-[13px] font-medium text-muted">Comercios</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Comercios activos" value={comerciosActivos} icon={Store} hint={`${rows.length} en total`} />
        <StatCard label="MRR estimado" value={formatMoney(mrr)} icon={Wallet} hint="Suma de planes activos" />
        <StatCard label="Clientes finales" value={formatNumber(totalClientes)} icon={Users} />
        <StatCard label="Visitas (30 días)" value={formatNumber(totalVisitas)} icon={CalendarCheck} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Inicios de sesión" description="Por día, últimos 30 días" />
          <div className="p-5">
            {inicios.length ? (
              <BarChart data={dailySeries(inicios.map((i) => i.createdAt), 30)} />
            ) : (
              <p className="py-10 text-center text-[13px] text-muted">Todavía no hay inicios de sesión registrados. El registro empezó con esta versión del panel.</p>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Requiere atención" />
          {alertas.length === 0 ? (
            <div className="flex items-center gap-2.5 p-5 text-sm text-ink-2">
              <CheckCircle2 className="size-5 text-success" aria-hidden /> Todo en orden.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {alertas.map((a) => (
                <li key={a.texto}>
                  <Link href={a.href} className="flex items-start gap-2.5 px-5 py-3 text-[13px] leading-snug hover:bg-canvas">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tono === "danger" ? "bg-danger" : a.tono === "warning" ? "bg-warning" : "bg-info"}`} aria-hidden />
                    <span className="text-ink-2">{a.texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Comercios con más actividad"
            action={
              <Link href="/admin/businesses" className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
                Ver todos <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Comercio</Th>
                <Th>Plan</Th>
                <Th>Clientes</Th>
                <Th>Visitas 30d</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.business.id} className="hover:bg-canvas">
                  <Td>
                    <Link href={`/admin/businesses/${r.business.id}`} className="flex items-center gap-3">
                      <BrandMark branding={r.business.branding} className="size-7 rounded-md text-[11px] font-semibold" style={{ background: r.business.branding.primary, color: "#fff" }} />
                      <span className="font-medium">{r.business.name}</span>
                    </Link>
                  </Td>
                  <Td className="text-muted">{r.plan.name}</Td>
                  <Td className="tabular">{formatNumber(r.customers)}</Td>
                  <Td className="tabular">{formatNumber(r.visits30d)}</Td>
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

        <Card className="min-w-0">
          <CardHeader title="Crecimiento" description="Altas por mes" />
          <Table>
            <thead>
              <tr>
                <Th>Mes</Th>
                <Th className="text-right">Usuarios</Th>
                <Th className="text-right">Comercios</Th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => (
                <tr key={m.clave}>
                  <Td className="capitalize text-muted">{m.nombre}</Td>
                  <Td className="tabular text-right">{usuariosMes[i]}</Td>
                  <Td className="tabular text-right">{comerciosMes[i]}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Actividad reciente"
            action={
              <Link href="/admin/audit" className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
                Ver auditoría <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          {recientes.length === 0 ? (
            <p className="p-5 text-[13px] text-muted">Sin actividad registrada.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recientes.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{nombreDe(a.actorId)}</span> <span className="text-ink-2">· {nombreAccion(a.action).toLowerCase()}</span>
                  </span>
                  <span className="text-xs text-muted">{formatRelative(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Accesos rápidos" />
          <div className="grid gap-1 p-3">
            {[
              { href: "/admin/users", texto: "Gestionar usuarios", icono: Users },
              { href: "/admin/businesses", texto: "Ver comercios", icono: Store },
              { href: "/admin/audit", texto: "Revisar la auditoría", icono: ScrollText },
              { href: "/admin/roles", texto: "Roles y permisos", icono: ShieldCheck },
            ].map(({ href, texto, icono: Icono }) => (
              <Link key={href} href={href} className="flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 hover:bg-cobalt/[0.07] hover:text-coal">
                <Icono className="size-4 text-muted" strokeWidth={1.75} aria-hidden /> {texto}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
