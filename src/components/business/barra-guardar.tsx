"use client";

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Barra fija al pie para páginas con borrador. Siempre está a la vista, para que se sepa que nada se aplica
 * sin pulsar «Guardar cambios»: sin cambios dice que todo está guardado y los botones quedan apagados.
 */
export function BarraGuardar({
  hayCambios,
  guardando,
  resultado,
  pendiente = "Tienes cambios sin guardar.",
  sinCambios = "No hay cambios por guardar.",
  onGuardar,
  onDescartar,
}: {
  hayCambios: boolean;
  guardando: boolean;
  resultado: { ok: boolean; texto: string } | null;
  /** Texto mientras hay cambios sin guardar. */
  pendiente?: string;
  /** Texto cuando no hay nada pendiente. */
  sinCambios?: string;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  const texto = resultado ? resultado.texto : hayCambios ? pendiente : sinCambios;
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 mt-6 flex justify-center px-2">
      <div
        role="status"
        className={cn(
          "pointer-events-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-pop sm:flex-row sm:items-center sm:justify-between",
          resultado && !resultado.ok ? "border-danger/40" : hayCambios ? "border-ink/30" : "border-line",
        )}
      >
        <p className={cn("text-sm", resultado ? (resultado.ok ? "text-success" : "text-danger") : hayCambios ? "font-medium text-ink" : "text-muted")}>{texto}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" disabled={guardando || !hayCambios} onClick={onDescartar}>
            Descartar
          </Button>
          <Button onClick={onGuardar} disabled={guardando || !hayCambios}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
