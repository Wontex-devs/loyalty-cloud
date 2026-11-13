"use client";

import { createContext, useContext, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { ESTADOS_CUENTA, ROLES_PLATAFORMA, type EstadoCuenta } from "@/lib/domain/acceso";
import type { PlatformRole } from "@/lib/domain/types";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ---------- Rol de quien usa el panel ---------- */

const ContextoRol = createContext<PlatformRole>("support");

export function ProveedorRol({ rol, children }: { rol: PlatformRole; children: React.ReactNode }) {
  return <ContextoRol.Provider value={rol}>{children}</ContextoRol.Provider>;
}

/** true si quien mira puede cambiar cosas. Soporte solo ve. (El servidor y la base lo vuelven a comprobar.) */
export const usePuedeEditar = () => useContext(ContextoRol) === "superadmin";

/* ---------- Etiquetas ---------- */

export function EtiquetaEstado({ estado }: { estado: EstadoCuenta }) {
  const e = ESTADOS_CUENTA[estado];
  return (
    <Badge tone={e.tono} dot>
      <span title={e.descripcion}>{e.nombre}</span>
    </Badge>
  );
}

export function EtiquetaRol({ rol }: { rol: PlatformRole }) {
  if (rol === "user") return <span className="text-[13px] text-muted">{ROLES_PLATAFORMA.user.corto}</span>;
  return <Badge tone={rol === "superadmin" ? "brand" : "info"}>{ROLES_PLATAFORMA[rol].corto}</Badge>;
}

/* ---------- Ventana modal ---------- */

/**
 * Ventana modal accesible: se cierra con Escape o tocando fuera, enfoca el primer campo
 * y devuelve el foco al botón que la abrió.
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  peligro,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  peligro?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const primero = ref.current?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]");
    primero?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coal/40 p-0 sm:items-start sm:p-4 sm:pt-[12vh]" onMouseDown={onCerrar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "animate-fade-up max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-pop sm:max-w-md sm:rounded-2xl",
          peligro && "border-t-4 border-t-danger",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={idTitulo} className="text-[15px] font-semibold text-coal">
              {titulo}
            </h2>
            {descripcion && <div className="mt-1 text-[13px] leading-relaxed text-muted">{descripcion}</div>}
          </div>
          <button type="button" onClick={onCerrar} className="-mr-1.5 rounded-md p-1.5 text-muted hover:bg-black/5 hover:text-ink" aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Mensaje de resultado bajo un formulario. */
export function Aviso({ aviso }: { aviso: { ok: boolean; texto: string } | null }) {
  if (!aviso) return null;
  return (
    <p role="status" className={cn("rounded-lg px-3 py-2 text-[13px]", aviso.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>
      {aviso.texto}
    </p>
  );
}

/** Descarga un texto como archivo (exportaciones CSV). */
export function descargar(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Paginación simple: «Anterior · página X de Y · Siguiente». */
export function Paginacion({ pagina, total, porPagina, onCambiar }: { pagina: number; total: number; porPagina: number; onCambiar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted">
      <span className="tabular">
        {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)} className="h-8 rounded-md px-2.5 font-medium text-ink-2 hover:bg-black/[0.04] disabled:opacity-40">
          Anterior
        </button>
        <span className="tabular px-1">
          {pagina} / {paginas}
        </span>
        <button type="button" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)} className="h-8 rounded-md px-2.5 font-medium text-ink-2 hover:bg-black/[0.04] disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  );
}
