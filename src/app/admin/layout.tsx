import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSession, loadPlatformSnapshot } from "@/lib/data/queries";
import { LiveProvider } from "@/lib/data/live-provider";
import { NoAccess } from "@/components/layout/no-access";
import { puedeVerPlataforma } from "@/lib/domain/acceso";

/** Panel de la plataforma: Superadministrador (todo) y Soporte (solo lectura). La base de datos aplica lo mismo con RLS. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!puedeVerPlataforma(session.profile)) return <NoAccess suspendida={!!session.profile?.suspendedAt} />;

  const snapshot = await loadPlatformSnapshot(session);
  return (
    <LiveProvider snapshot={snapshot}>
      <AdminShell rol={session.profile!.platformRole}>{children}</AdminShell>
    </LiveProvider>
  );
}
