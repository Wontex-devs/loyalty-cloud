"use client";

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Barra fija al pie para páginas con borrador: avisa que hay cambios sin guardar y ofrece
 * «Descartar» y «Guardar cambios». Después de guardar muestra el resultado.
 */
export function BarraGuardar({
  hayCambios,
  guardando,
  resultado,
  pendiente = "Tienes cambios sin guardar.",
  onGuardar,
  onDescartar,
}: {
  hayCambios: boolean;
  guardando: boolean;
  resultado: { ok: boolean; texto: string } | null;
  /** Texto mientras hay cambios sin guardar. */
  pendiente?: string;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  if (!hayCambios && !resultado) return null;
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 mt-6 flex justify-center px-2">
      <div
        role="status"
        className={cn(
          "pointer-events-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-pop sm:flex-row sm:items-center sm:justify-between",
          resultado && !resultado.ok ? "border-danger/40" : "border-line",
        )}
      >
        <p className={cn("text-sm", resultado ? (resultado.ok ? "text-success" : "text-danger") : "text-ink")}>{resultado ? resultado.texto : pendiente}</p>
        {hayCambios && (
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" disabled={guardando} onClick={onDescartar}>
              Descartar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar cambios
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
