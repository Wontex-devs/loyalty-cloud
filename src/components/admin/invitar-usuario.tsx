"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { invitarUsuarioAction } from "@/lib/data/admin-actions";
import { ROLES_COMERCIO, ROLES_PLATAFORMA } from "@/lib/domain/acceso";
import { useData } from "@/lib/data/store";
import { Button, Field, Input, Select, Segmented } from "@/components/ui";
import { Aviso, Modal } from "./piezas";

type Tipo = "comercio" | "plataforma";

/** Invita a una persona: a un comercio (propietario, administrador o empleado) o al equipo de la plataforma. */
export function InvitarUsuario() {
  const router = useRouter();
  const { state } = useData();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("comercio");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [comercio, setComercio] = useState("");
  const [rolComercio, setRolComercio] = useState<"owner" | "admin" | "staff">("staff");
  const [canjea, setCanjea] = useState(false);
  const [rolPlataforma, setRolPlataforma] = useState<"support" | "superadmin">("support");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const conDueno = new Set(state.memberships.filter((m) => m.role === "owner").map((m) => m.businessId));
  const comercios = [...state.businesses].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const cerrar = () => {
    setAbierto(false);
    setAviso(null);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setAviso(null);
    try {
      const r = await invitarUsuarioAction(
        tipo === "plataforma"
          ? { tipo, fullName: nombre, email: correo, rol: rolPlataforma }
          : { tipo, fullName: nombre, email: correo, businessId: comercio, rol: rolComercio, canRedeem: canjea },
      );
      setAviso({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo completar.") });
      if (r.ok) {
        setNombre("");
        setCorreo("");
        router.refresh();
      }
    } catch {
      setAviso({ ok: false, texto: "No pudimos conectar. Inténtalo de nuevo." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button onClick={() => setAbierto(true)}>
        <UserPlus className="size-4" /> Invitar usuario
      </Button>
      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        titulo="Invitar usuario"
        descripcion="La persona recibe un correo para crear su propia contraseña. Nadie del panel ve ni escribe contraseñas."
      >
        <form onSubmit={enviar} className="space-y-4">
          <Segmented<Tipo>
            value={tipo}
            onChange={setTipo}
            options={[
              { value: "comercio", label: "A un comercio" },
              { value: "plataforma", label: "Equipo de Lazo" },
            ]}
          />
          <Field label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" required minLength={2} maxLength={80} />
          </Field>
          <Field label="Correo">
            <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" required />
          </Field>

          {tipo === "comercio" ? (
            <>
              <Field label="Comercio">
                <Select value={comercio} onChange={(e) => setComercio(e.target.value)} required>
                  <option value="">Elige un comercio…</option>
                  {comercios.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rol en el comercio" hint={ROLES_COMERCIO[rolComercio].descripcion}>
                <Select value={rolComercio} onChange={(e) => setRolComercio(e.target.value as typeof rolComercio)}>
                  <option value="staff">{ROLES_COMERCIO.staff.nombre}</option>
                  <option value="admin">{ROLES_COMERCIO.admin.nombre}</option>
                  <option value="owner" disabled={!!comercio && conDueno.has(comercio)}>
                    {ROLES_COMERCIO.owner.nombre}
                    {comercio && conDueno.has(comercio) ? " (ya tiene)" : ""}
                  </option>
                </Select>
              </Field>
              {rolComercio === "staff" && (
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input type="checkbox" checked={canjea} onChange={(e) => setCanjea(e.target.checked)} className="size-4 accent-cobalt" />
                  Puede canjear premios
                </label>
              )}
            </>
          ) : (
            <Field label="Rol en la plataforma" hint={ROLES_PLATAFORMA[rolPlataforma].descripcion}>
              <Select value={rolPlataforma} onChange={(e) => setRolPlataforma(e.target.value as typeof rolPlataforma)}>
                <option value="support">{ROLES_PLATAFORMA.support.nombre}</option>
                <option value="superadmin">{ROLES_PLATAFORMA.superadmin.nombre}</option>
              </Select>
            </Field>
          )}

          <Aviso aviso={aviso} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={cerrar}>
              Cerrar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="size-4 animate-spin" />} Enviar invitación
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
