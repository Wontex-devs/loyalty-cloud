import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSession, loadPlatformSnapshot } from "@/lib/data/queries";
import { LiveProvider } from "@/lib/data/live-provider";
import { NoAccess } from "@/components/layout/no-access";
import { puedeVerPlataforma } from "@/lib/domain/acceso";
import { appleWalletConfig } from "@/lib/wallet/config";
import { certStatus } from "@/lib/wallet/cert-expiry";

/** Panel de la plataforma: Superadministrador (todo) y Soporte (solo lectura). La base de datos aplica lo mismo con RLS. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!puedeVerPlataforma(session.profile)) return <NoAccess suspendida={!!session.profile?.suspendedAt} />;

  const snapshot = await loadPlatformSnapshot(session);
  // Certificado de Apple Wallet: aviso con 60 días de anticipación (o si ya venció).
  const apple = appleWalletConfig();
  const cert = apple ? certStatus(apple.certPem) : null;
  return (
    <LiveProvider snapshot={snapshot}>
      <AdminShell rol={session.profile!.platformRole} certAviso={cert?.alert ? cert : null}>{children}</AdminShell>
    </LiveProvider>
  );
}
