"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Pencil, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import {
  cambiarRolPlataformaAction,
  editarUsuarioAction,
  enviarEnlaceContrasenaAction,
  reactivarUsuarioAction,
  suspenderUsuarioAction,
  type ResultadoAdmin,
} from "@/lib/data/admin-actions";
import { deleteUserAction } from "@/lib/data/actions";
import type { UsuarioPanel } from "@/lib/data/admin-queries";
import { ROLES_PLATAFORMA } from "@/lib/domain/acceso";
import type { PlatformRole } from "@/lib/domain/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Aviso, Modal } from "./piezas";

type Dialogo = null | "editar" | "rol" | "suspender" | "reactivar" | "enlace" | "eliminar";

/** Acciones sobre una cuenta. Todas piden confirmación en una ventana y el servidor vuelve a comprobar el permiso. */
export function UsuarioAcciones({ usuario: u, esMiCuenta }: { usuario: UsuarioPanel; esMiCuenta: boolean }) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nombre, setNombre] = useState(u.fullName);
  const [rol, setRol] = useState<PlatformRole>(u.platformRole);
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const abrir = (d: Dialogo) => {
    setAviso(null);
    setConfirmacion("");
    setNombre(u.fullName);
    setRol(u.platformRole);
    setMotivo("");
    setDialogo(d);
  };
  const cerrar = useCallback(() => setDialogo(null), []);

  const ejecutar = async (fn: () => Promise<ResultadoAdmin>, { alTerminar }: { alTerminar?: () => void } = {}) => {
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await fn();
      setAviso({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo completar.") });
      if (r.ok) {
        router.refresh();
        alTerminar?.();
      }
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setTrabajando(false);
    }
  };

  if (esMiCuenta) {
    return <p className="text-[13px] text-muted">Es tu cuenta. Para cambiar tu rol o suspenderla, pídeselo a otro superadministrador.</p>;
  }

  const suspendida = !!u.suspendedAt;
  const boton = "w-full justify-start";

  return (
    <>
      <div className="grid gap-1.5">
        <Button variant="secondary" className={boton} onClick={() => abrir("editar")}>
          <Pencil className="size-4" /> Editar nombre
        </Button>
        <Button variant="secondary" className={boton} onClick={() => abrir("rol")}>
          <ShieldCheck className="size-4" /> Cambiar rol de plataforma
        </Button>
        {!suspendida && (
          <Button variant="secondary" className={boton} onClick={() => abrir("enlace")}>
            <KeyRound className="size-4" /> Enviar enlace de contraseña
          </Button>
        )}
        {suspendida ? (
          <Button variant="secondary" className={boton} onClick={() => abrir("reactivar")}>
            <UserCheck className="size-4" /> Reactivar cuenta
          </Button>
        ) : (
          <Button variant="secondary" className={`${boton} text-danger`} onClick={() => abrir("suspender")}>
            <UserX className="size-4" /> Suspender cuenta
          </Button>
        )}
        <Button variant="ghost" className={`${boton} text-danger`} onClick={() => abrir("eliminar")}>
          <Trash2 className="size-4" /> Eliminar cuenta
        </Button>
      </div>

      <Modal abierto={dialogo === "editar"} onCerrar={cerrar} titulo="Editar nombre" descripcion="El correo no se cambia desde aquí: es el que usa para entrar.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ejecutar(() => editarUsuarioAction(u.id, nombre));
          }}
        >
          <Field label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} />
          </Field>
          <Aviso aviso={aviso} />
          <Pie onCerrar={cerrar} trabajando={trabajando} texto="Guardar" />
        </form>
      </Modal>

      <Modal abierto={dialogo === "rol"} onCerrar={cerrar} titulo="Cambiar rol de plataforma" descripcion="Su acceso a los comercios no cambia: eso se gestiona en cada comercio.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ejecutar(() => cambiarRolPlataformaAction(u.id, rol));
          }}
        >
          <Field label="Rol" hint={ROLES_PLATAFORMA[rol].descripcion}>
            <Select value={rol} onChange={(e) => setRol(e.target.value as PlatformRole)}>
              {(Object.keys(ROLES_PLATAFORMA) as PlatformRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLES_PLATAFORMA[r].nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Aviso aviso={aviso} />
          <Pie onCerrar={cerrar} trabajando={trabajando} texto="Cambiar rol" desactivado={rol === u.platformRole} />
        </form>
      </Modal>

      <Modal
        abierto={dialogo === "enlace"}
        onCerrar={cerrar}
        titulo="Enviar enlace de contraseña"
        descripcion={
          <>
            Enviaremos a <strong className="text-ink">{u.email}</strong> un enlace para crear una contraseña nueva. Sirve una vez y vence en una hora. Su contraseña actual sigue
            funcionando hasta que la cambie.
          </>
        }
      >
        <div className="space-y-4">
          <Aviso aviso={aviso} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cerrar}>
              Cerrar
            </Button>
            <Button data-autofocus disabled={trabajando} onClick={() => void ejecutar(() => enviarEnlaceContrasenaAction(u.id))}>
              {trabajando && <Loader2 className="size-4 animate-spin" />} Enviar enlace
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        abierto={dialogo === "suspender"}
        onCerrar={cerrar}
        peligro
        titulo={`Suspender a ${u.fullName}`}
        descripcion="Pierde el acceso de inmediato: no puede entrar ni ver datos de ningún comercio. Sus datos y su historial se conservan, y puedes reactivarla cuando quieras."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ejecutar(() => suspenderUsuarioAction(u.id, motivo));
          }}
        >
          <Field label="Motivo (opcional)" hint="Queda en la auditoría. Hasta 300 caracteres.">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} />
          </Field>
          <Aviso aviso={aviso} />
          <Pie onCerrar={cerrar} trabajando={trabajando} texto="Suspender cuenta" peligro />
        </form>
      </Modal>

      <Modal abierto={dialogo === "reactivar"} onCerrar={cerrar} titulo={`Reactivar a ${u.fullName}`} descripcion="Recupera el acceso que tenía antes de la suspensión.">
        <div className="space-y-4">
          <Aviso aviso={aviso} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cerrar}>
              Cerrar
            </Button>
            <Button data-autofocus disabled={trabajando} onClick={() => void ejecutar(() => reactivarUsuarioAction(u.id))}>
              {trabajando && <Loader2 className="size-4 animate-spin" />} Reactivar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        abierto={dialogo === "eliminar"}
        onCerrar={cerrar}
        peligro
        titulo={`Eliminar la cuenta de ${u.fullName}`}
        descripcion="Ya no podrá entrar. Las visitas y canjes que registró siguen en el historial, sin su nombre. No se puede deshacer: si solo quieres quitarle el acceso por un tiempo, suspéndela."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ejecutar(() => deleteUserAction(u.id), { alTerminar: () => router.push("/admin/users") });
          }}
        >
          <Field label={`Para confirmar, escribe su correo: ${u.email}`}>
            <Input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" spellCheck={false} />
          </Field>
          <Aviso aviso={aviso} />
          <Pie onCerrar={cerrar} trabajando={trabajando} texto="Eliminar para siempre" peligro desactivado={confirmacion.trim().toLowerCase() !== u.email.toLowerCase()} />
        </form>
      </Modal>
    </>
  );
}

function Pie({ onCerrar, trabajando, texto, peligro, desactivado }: { onCerrar: () => void; trabajando: boolean; texto: string; peligro?: boolean; desactivado?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="ghost" onClick={onCerrar}>
        Cerrar
      </Button>
      <Button type="submit" variant={peligro ? "danger" : "primary"} disabled={trabajando || desactivado}>
        {trabajando && <Loader2 className="size-4 animate-spin" />} {texto}
      </Button>
    </div>
  );
}
