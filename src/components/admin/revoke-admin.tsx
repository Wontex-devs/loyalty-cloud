"use client";

import { useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { revokeSuperadminAction } from "@/lib/data/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Button } from "@/components/ui";

/** Quita el acceso de administrador de la plataforma a una persona. No borra su cuenta. Solo en la versión real. */
export function RevokeAdmin({ profileId, nombre }: { profileId: string; nombre: string }) {
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <Button variant="ghost" size="sm" disabled title="Funciona en la versión real, no en la demostración">
        <UserMinus className="size-4" /> Quitar acceso
      </Button>
    );
  }

  const quitar = async () => {
    if (!window.confirm(`¿Quitarle a ${nombre} el acceso de administrador de la plataforma? Su cuenta no se borra, pero ya no podrá entrar a todos los comercios.`)) return;
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await revokeSuperadminAction(profileId);
      setAviso({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo completar.") });
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" onClick={() => void quitar()} disabled={trabajando}>
        {trabajando ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-4" />} Quitar acceso
      </Button>
      {aviso && <p className={aviso.ok ? "text-xs text-success" : "text-xs text-danger"}>{aviso.texto}</p>}
    </div>
  );
}
