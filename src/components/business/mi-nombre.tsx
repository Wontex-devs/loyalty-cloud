"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/admin/piezas";
import { Button, Field, Input } from "@/components/ui";

/**
 * Cada persona del panel pone o cambia su propio nombre.
 * La base solo deja actualizar la columna full_name del propio perfil (grant + política profiles_update_self).
 */
export function MiNombre({ profileId, actual, faltante }: { profileId: string; actual: string; faltante: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(faltante ? "" : actual);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim().replace(/\s+/g, " ");
    if (limpio.length < 2 || limpio.length > 80) return setError("Escribe tu nombre (de 2 a 80 letras).");
    if (limpio.includes("@")) return setError("Escribe tu nombre, no tu correo.");
    setGuardando(true);
    setError(null);
    const { data, error: err } = await createClient().from("profiles").update({ full_name: limpio }).eq("id", profileId).select("id");
    if (err || !data?.length) {
      setGuardando(false);
      return setError("No se pudo guardar. Inténtalo de nuevo.");
    }
    window.location.reload();
  };

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="text-xs font-medium text-cobalt hover:underline">
        {faltante ? "Agregar mi nombre" : "Cambiar mi nombre"}
      </button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Tu nombre" descripcion="Así te saludamos en el panel y así te ve tu equipo.">
        <form onSubmit={guardar} className="space-y-4">
          <Field label="Nombre y apellido" error={error ?? undefined}>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" autoFocus maxLength={80} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="size-4 animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
