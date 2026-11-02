import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSession, loadPlatformSnapshot } from "@/lib/data/queries";
import { LiveProvider } from "@/lib/data/live-provider";
import { NoAccess } from "@/components/layout/no-access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <AdminShell>{children}</AdminShell>;

  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.profile?.platformRole !== "superadmin") return <NoAccess />;

  const snapshot = await loadPlatformSnapshot(session);
  return (
    <LiveProvider snapshot={snapshot}>
      <AdminShell>{children}</AdminShell>
    </LiveProvider>
  );
}
