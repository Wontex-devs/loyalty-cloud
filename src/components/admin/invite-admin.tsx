"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { inviteSuperadminAction } from "@/lib/data/actions";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";

/** Botón y formulario para invitar a otro superadministrador de la plataforma. Solo en la versión real. */
export function InviteAdmin() {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);


  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setAviso(null);
    try {
      const r = await inviteSuperadminAction({ fullName: nombre, email: correo });
      setAviso({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo completar.") });
      if (r.ok) {
        setNombre("");
        setCorreo("");
      }
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <UserPlus className="size-4" /> Invitar administrador
      </Button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24" onClick={() => setAbierto(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader
              title="Invitar administrador de la plataforma"
              description="Tendrá acceso a todos los comercios. Recibe un correo para crear su propia contraseña."
            />
            <form onSubmit={enviar} className="space-y-4 p-5">
              <Field label="Nombre">
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" required minLength={2} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" required />
              </Field>
              {aviso && <p className={aviso.ok ? "text-sm text-success" : "text-sm text-danger"}>{aviso.texto}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  Cerrar
                </Button>
                <Button type="submit" disabled={enviando}>
                  {enviando && <Loader2 className="size-4 animate-spin" />} Enviar invitación
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
