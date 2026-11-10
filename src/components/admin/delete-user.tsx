"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteUserAction } from "@/lib/data/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Button } from "@/components/ui";

/** Elimina la cuenta de una persona del panel. Pide escribir su correo para confirmar. Solo en la versión real. */
export function DeleteUser({ profileId, nombre, correo }: { profileId: string; nombre: string; correo: string }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <Button variant="ghost" size="sm" disabled title="Funciona en la versión real, no en la demostración">
        <Trash2 className="size-4" /> Eliminar
      </Button>
    );
  }

  const eliminar = async () => {
    const escrito = window.prompt(
      `Vas a eliminar la cuenta de ${nombre}. Ya no podrá entrar al panel. Las visitas que registró siguen en el historial, sin su nombre.\n\nNo se puede deshacer. Para confirmar, escribe su correo:\n${correo}`,
    );
    if (escrito === null) return;
    if (escrito.trim().toLowerCase() !== correo.toLowerCase()) {
      setAviso({ ok: false, texto: "El correo no coincide. No se eliminó nada." });
      return;
    }
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await deleteUserAction(profileId);
      setAviso({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo completar.") });
      if (r.ok) router.refresh();
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" onClick={() => void eliminar()} disabled={trabajando} className="text-danger">
        {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Eliminar
      </Button>
      {aviso && <p className={aviso.ok ? "max-w-56 text-xs text-success" : "max-w-56 text-xs text-danger"}>{aviso.texto}</p>}
    </div>
  );
}
