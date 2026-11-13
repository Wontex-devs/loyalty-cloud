"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportarAuditoriaAction } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui";
import { descargar, usePuedeEditar } from "./piezas";

/** Exporta a CSV la auditoría con los filtros actuales (hasta 5.000 filas). La exportación queda registrada. */
export function AuditoriaExportar({ filtros }: { filtros: { grupo?: string; ambito?: string; actor?: string; desde?: string; hasta?: string } }) {
  const puedeEditar = usePuedeEditar();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!puedeEditar) return null;

  const exportar = async () => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await exportarAuditoriaAction(filtros);
      if (r.ok && r.csv) descargar(`lazo-auditoria-${new Date().toISOString().slice(0, 10)}.csv`, r.csv);
      else setError(r.message ?? "No se pudo exportar.");
    } catch {
      setError("No pudimos conectar. Inténtalo de nuevo.");
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={() => void exportar()} disabled={trabajando}>
        {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Exportar CSV
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
