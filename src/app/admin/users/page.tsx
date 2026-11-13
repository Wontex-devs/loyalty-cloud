import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { cargarUsuarios } from "@/lib/data/admin-queries";
import { getSession } from "@/lib/data/queries";
import { esSuperadmin, estadoCuenta } from "@/lib/domain/acceso";
import { InvitarUsuario } from "@/components/admin/invitar-usuario";
import { UsuariosTabla } from "@/components/admin/usuarios-tabla";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const [{ usuarios, aviso }, session] = await Promise.all([cargarUsuarios(), getSession()]);
  const cuenta = (e: string) => usuarios.filter((u) => estadoCuenta(u) === e).length;

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={
          aviso
            ? "Cuentas con acceso a los paneles. Los clientes finales no tienen cuenta."
            : `${usuarios.length} cuentas · ${cuenta("activa")} activas · ${cuenta("pendiente")} con invitación pendiente · ${cuenta("suspendida")} suspendidas`
        }
        actions={esSuperadmin(session?.profile) ? <InvitarUsuario /> : undefined}
      />
      {aviso ? (
        <Card className="flex items-start gap-3 p-5 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>{aviso}</p>
        </Card>
      ) : (
        <UsuariosTabla usuarios={usuarios} />
      )}
    </>
  );
}
