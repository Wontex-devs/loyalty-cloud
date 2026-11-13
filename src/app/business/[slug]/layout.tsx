import { redirect } from "next/navigation";
import { BusinessShell } from "@/components/business/business-shell";
import { getSession, loadBusinessSnapshot } from "@/lib/data/queries";
import { LiveProvider } from "@/lib/data/live-provider";
import { NoAccess } from "@/components/layout/no-access";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/business/${slug}`);

  // RLS: si el usuario no es miembro, el comercio simplemente no aparece.
  const snapshot = await loadBusinessSnapshot(slug, session);
  const isMember = session.memberships.some((m) => m.business?.slug === slug);
  if (!snapshot || !isMember) return <NoAccess suspendida={!!session.profile?.suspendedAt} />;

  return (
    <LiveProvider snapshot={snapshot}>
      <BusinessShell slug={slug}>{children}</BusinessShell>
    </LiveProvider>
  );
}
