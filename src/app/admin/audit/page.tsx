import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { z } from "zod";
import { consultarAuditoria, FILAS_POR_PAGINA } from "@/lib/data/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { describirDetalle, GRUPOS_AUDITORIA, nombreAccion, type GrupoAuditoria } from "@/lib/domain/acceso";
import { AuditoriaExportar } from "@/components/admin/auditoria-exportar";
import { Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoría" };

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Registro de auditoría: quién hizo qué y cuándo. No se puede editar ni borrar (lo impide la base de datos). */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const grupo = (texto(sp.grupo) in GRUPOS_AUDITORIA ? texto(sp.grupo) : "") as GrupoAuditoria | "";
  const ambitoCrudo = texto(sp.ambito);
  const ambito = ambitoCrudo && z.uuid().safeParse(ambitoCrudo).success ? ambitoCrudo : "plataforma";
  const actor = z.uuid().safeParse(texto(sp.actor)).success ? texto(sp.actor) : "";
  const desde = fecha.safeParse(texto(sp.desde)).success ? texto(sp.desde) : "";
  const hasta = fecha.safeParse(texto(sp.hasta)).success ? texto(sp.hasta) : "";
  const pagina = Math.max(1, Number.parseInt(texto(sp.pagina), 10) || 1);

  const supabase = await createClient();
  const [{ filas, total, error }, { data: perfiles }, { data: comercios }] = await Promise.all([
    consultarAuditoria({ pagina, grupo: grupo || undefined, ambito, actor: actor || undefined, desde: desde || undefined, hasta: hasta || undefined }),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("businesses").select("id, name").order("name"),
  ]);
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string)]));
  const nombreComercio = new Map((comercios ?? []).map((c) => [c.id as string, c.name as string]));
  const paginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA));
  const filtros = { grupo: grupo || undefined, ambito, actor: actor || undefined, desde: desde || undefined, hasta: hasta || undefined };
  const enlace = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...filtros, pagina: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/admin/audit?${q.toString()}`;
  };
  const hayFiltros = !!(grupo || actor || desde || hasta || ambito !== "plataforma");

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué y cuándo. Los registros no se pueden modificar ni borrar."
        actions={<AuditoriaExportar filtros={filtros} />}
      />

      <Card>
        {/* Formulario GET: los filtros quedan en la dirección y funcionan sin JavaScript. */}
        <form method="get" className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_auto_auto_auto] lg:items-end">
          <label className="block text-[13px] font-medium text-ink">
            <span className="mb-1.5 block">Ámbito</span>
            <Select name="ambito" defaultValue={ambito}>
              <option value="plataforma">Plataforma</option>
              {(comercios ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  Comercio: {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-[13px] font-medium text-ink">
            <span className="mb-1.5 block">Tipo de acción</span>
            <Select name="grupo" defaultValue={grupo}>
              <option value="">Todas</option>
              {(Object.keys(GRUPOS_AUDITORIA) as GrupoAuditoria[]).map((g) => (
                <option key={g} value={g}>
                  {GRUPOS_AUDITORIA[g].nombre}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-[13px] font-medium text-ink">
            <span className="mb-1.5 block">Quién</span>
            <Select name="actor" defaultValue={actor}>
              <option value="">Cualquiera</option>
              {(perfiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.full_name as string) || (p.email as string)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-[13px] font-medium text-ink">
            <span className="mb-1.5 block">Desde</span>
            <Input type="date" name="desde" defaultValue={desde} />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            <span className="mb-1.5 block">Hasta</span>
            <Input type="date" name="hasta" defaultValue={hasta} />
          </label>
          <div className="flex gap-2">
            <Button type="submit">Filtrar</Button>
            {hayFiltros && (
              <Link href="/admin/audit" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-black/[0.04]">
                Limpiar
              </Link>
            )}
          </div>
        </form>

        {error ? (
          <p className="p-5 text-sm text-danger">No se pudo leer la auditoría. Inténtalo de nuevo.</p>
        ) : filas.length === 0 ? (
          <EmptyState icon={ScrollText} title="No hay registros con estos filtros" description={hayFiltros ? "Prueba con otras fechas o quita los filtros." : undefined} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Quién</Th>
                  <Th>Acción</Th>
                  <Th>Sobre</Th>
                  <Th>Detalle</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((a) => {
                  const sobre =
                    a.entity === "profile"
                      ? { texto: nombre.get(a.entityId) ?? "Cuenta eliminada", href: nombre.has(a.entityId) ? `/admin/users/${a.entityId}` : undefined }
                      : a.entity === "business"
                        ? { texto: nombreComercio.get(a.entityId) ?? "Comercio eliminado", href: nombreComercio.has(a.entityId) ? `/admin/businesses/${a.entityId}` : undefined }
                        : { texto: a.entity };
                  return (
                    <tr key={a.id} className="align-top">
                      <Td className="text-muted tabular">{formatDateTime(a.createdAt)}</Td>
                      <Td>
                        {a.actorId ? (
                          nombre.has(a.actorId) ? (
                            <Link href={`/admin/users/${a.actorId}`} className="font-medium hover:text-cobalt">
                              {nombre.get(a.actorId)}
                            </Link>
                          ) : (
                            <span className="text-muted">Cuenta eliminada</span>
                          )
                        ) : (
                          <span className="text-muted">Sistema</span>
                        )}
                      </Td>
                      <Td>
                        <span className="font-medium">{nombreAccion(a.action)}</span>
                        <code className="mt-0.5 block font-mono text-[11px] text-subtle">{a.action}</code>
                      </Td>
                      <Td>
                        {sobre.href ? (
                          <Link href={sobre.href} className="hover:text-cobalt">
                            {sobre.texto}
                          </Link>
                        ) : (
                          <span className="text-muted">{sobre.texto}</span>
                        )}
                      </Td>
                      <Td>
                        <span className="block w-64 text-[13px] whitespace-normal text-ink-2">{describirDetalle(a) ?? <span className="text-subtle">—</span>}</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <nav aria-label="Páginas" className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted">
              <span className="tabular">
                {(pagina - 1) * FILAS_POR_PAGINA + 1}–{Math.min(total, pagina * FILAS_POR_PAGINA)} de {total}
              </span>
              <div className="flex items-center gap-1">
                {pagina > 1 ? (
                  <Link href={enlace(pagina - 1)} className="h-8 rounded-md px-2.5 leading-8 font-medium text-ink-2 hover:bg-black/[0.04]">
                    Anterior
                  </Link>
                ) : (
                  <span className="h-8 px-2.5 leading-8 opacity-40">Anterior</span>
                )}
                <span className="tabular px-1">
                  {pagina} / {paginas}
                </span>
                {pagina < paginas ? (
                  <Link href={enlace(pagina + 1)} className="h-8 rounded-md px-2.5 leading-8 font-medium text-ink-2 hover:bg-black/[0.04]">
                    Siguiente
                  </Link>
                ) : (
                  <span className="h-8 px-2.5 leading-8 opacity-40">Siguiente</span>
                )}
              </div>
            </nav>
          </>
        )}
      </Card>
    </>
  );
}
