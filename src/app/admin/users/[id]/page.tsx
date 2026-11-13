import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import { cargarDetalleUsuario, cargarUsuarios } from "@/lib/data/admin-queries";
import { UsuarioDetalle } from "@/components/admin/usuario-detalle";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Usuario" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ usuarios, aviso }, detalle] = await Promise.all([cargarUsuarios(), cargarDetalleUsuario(id)]);
  if (aviso) {
    return (
      <Card className="flex items-start gap-3 p-5 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <p>{aviso}</p>
      </Card>
    );
  }
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) notFound();

  return <UsuarioDetalle usuario={usuario} {...detalle} />;
}
