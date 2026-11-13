import { cargarIniciosRecientes, cargarUsuarios } from "@/lib/data/admin-queries";
import { Resumen } from "@/components/admin/resumen";

/** Resumen de la plataforma: usuarios, comercios, alertas y actividad. */
export default async function AdminDashboard() {
  const [{ usuarios, aviso }, inicios] = await Promise.all([cargarUsuarios(), cargarIniciosRecientes(30)]);
  return <Resumen usuarios={usuarios} inicios={inicios} aviso={aviso} />;
}
