"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Search, Users } from "lucide-react";
import type { UsuarioPanel } from "@/lib/data/admin-queries";
import { exportarUsuariosAction } from "@/lib/data/admin-actions";
import { ESTADOS_CUENTA, estadoCuenta, ROLES_PLATAFORMA, type EstadoCuenta } from "@/lib/domain/acceso";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import type { PlatformRole } from "@/lib/domain/types";
import { useData } from "@/lib/data/store";
import { Avatar, Button, Card, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui";
import { formatDate, formatRelative } from "@/lib/utils";
import { Aviso, descargar, EtiquetaEstado, EtiquetaRol, Paginacion, usePuedeEditar } from "./piezas";

const POR_PAGINA = 20;

/** Listado de cuentas del panel con búsqueda, filtros, paginación y exportación. */
export function UsuariosTabla({ usuarios }: { usuarios: UsuarioPanel[] }) {
  const { state } = useData();
  const puedeEditar = usePuedeEditar();
  const [texto, setTexto] = useState("");
  const [rol, setRol] = useState<"" | PlatformRole>("");
  const [estado, setEstado] = useState<"" | EstadoCuenta>("");
  const [comercio, setComercio] = useState("");
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return usuarios
      .map((u) => ({ u, estado: estadoCuenta(u), membresias: state.memberships.filter((m) => m.profileId === u.id) }))
      .filter(({ u, estado: e, membresias }) => {
        if (t && !`${u.fullName} ${u.email}`.toLowerCase().includes(t)) return false;
        if (rol && u.platformRole !== rol) return false;
        if (estado && e !== estado) return false;
        if (comercio && !membresias.some((m) => m.businessId === comercio)) return false;
        return true;
      });
  }, [usuarios, state.memberships, texto, rol, estado, comercio]);

  const paginaReal = Math.min(pagina, Math.max(1, Math.ceil(filas.length / POR_PAGINA)));
  const visibles = filas.slice((paginaReal - 1) * POR_PAGINA, paginaReal * POR_PAGINA);
  const filtrar = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPagina(1);
  };
  const hayFiltros = !!(texto || rol || estado || comercio);

  const exportar = async () => {
    setExportando(true);
    setAviso(null);
    try {
      const r = await exportarUsuariosAction();
      if (r.ok && r.csv) descargar(`lazo-usuarios-${new Date().toISOString().slice(0, 10)}.csv`, r.csv);
      else setAviso({ ok: false, texto: r.message ?? "No se pudo exportar." });
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setExportando(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1 xl:min-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input value={texto} onChange={(e) => filtrar(setTexto)(e.target.value)} placeholder="Buscar por nombre o correo" className="pl-9" aria-label="Buscar usuarios" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
          <Select value={rol} onChange={(e) => filtrar(setRol)(e.target.value as typeof rol)} aria-label="Filtrar por rol" className="xl:w-40">
            <option value="">Todos los roles</option>
            {(Object.keys(ROLES_PLATAFORMA) as PlatformRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLES_PLATAFORMA[r].corto}
              </option>
            ))}
          </Select>
          <Select value={estado} onChange={(e) => filtrar(setEstado)(e.target.value as typeof estado)} aria-label="Filtrar por estado" className="xl:w-44">
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADOS_CUENTA) as EstadoCuenta[]).map((k) => (
              <option key={k} value={k}>
                {ESTADOS_CUENTA[k].nombre}
              </option>
            ))}
          </Select>
          <Select value={comercio} onChange={(e) => filtrar(setComercio)(e.target.value)} aria-label="Filtrar por comercio" className="col-span-2 sm:col-span-1 xl:w-48">
            <option value="">Todos los comercios</option>
            {[...state.businesses]
              .sort((a, b) => a.name.localeCompare(b.name, "es"))
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </Select>
        </div>
        {puedeEditar && (
          <Button variant="secondary" onClick={() => void exportar()} disabled={exportando}>
            {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Exportar CSV
          </Button>
        )}
      </div>
      {aviso && (
        <div className="px-5 pt-4">
          <Aviso aviso={aviso} />
        </div>
      )}

      {filas.length === 0 ? (
        <EmptyState icon={Users} title={hayFiltros ? "Ningún usuario coincide con los filtros" : "Todavía no hay usuarios"} description={hayFiltros ? "Prueba con otra búsqueda o quita los filtros." : undefined} />
      ) : (
        <>
          {/* Escritorio y tableta: tabla */}
          <Table className="hidden md:block">
            <thead>
              <tr>
                <Th>Usuario</Th>
                <Th>Rol</Th>
                <Th>Comercios</Th>
                <Th>Estado</Th>
                <Th>Último acceso</Th>
                <Th className="hidden xl:table-cell">Alta</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ u, estado: e, membresias }) => (
                <tr key={u.id} className="group hover:bg-canvas">
                  <Td>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 outline-none">
                      <Avatar name={u.fullName} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink group-hover:text-cobalt">
                          {u.fullName}
                          {u.id === state.actingProfileId && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                        </span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <EtiquetaRol rol={u.platformRole} />
                  </Td>
                  <Td>
                    {membresias.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <div className="w-52 space-y-0.5 text-[13px] whitespace-normal text-ink-2">
                        {membresias.slice(0, 2).map((m) => (
                          <p key={m.id} className="truncate">
                            {state.businesses.find((b) => b.id === m.businessId)?.name ?? "?"} <span className="text-muted">· {ROLE_LABELS[m.role]}</span>
                          </p>
                        ))}
                        {membresias.length > 2 && <p className="text-muted">y {membresias.length - 2} más</p>}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <EtiquetaEstado estado={e} />
                  </Td>
                  <Td className="text-muted">{u.lastSignInAt ? formatRelative(u.lastSignInAt) : "Nunca"}</Td>
                  <Td className="hidden text-muted xl:table-cell">{formatDate(u.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Celular: lista */}
          <ul className="divide-y divide-line md:hidden">
            {visibles.map(({ u, estado: e }) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-canvas">
                  <Avatar name={u.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.fullName}</span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <EtiquetaEstado estado={e} />
                    <EtiquetaRol rol={u.platformRole} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Paginacion pagina={paginaReal} total={filas.length} porPagina={POR_PAGINA} onCambiar={setPagina} />
        </>
      )}
    </Card>
  );
}
