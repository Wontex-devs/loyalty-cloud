import { redirect } from "next/navigation";
import { BusinessShell } from "@/components/business/business-shell";
import { SupportEntry } from "@/components/business/support-entry";
import { EntradaSuperadmin } from "@/components/business/entrada-superadmin";
import { getSession, loadBusinessSnapshot } from "@/lib/data/queries";
import { LiveProvider } from "@/lib/data/live-provider";
import { NoAccess } from "@/components/layout/no-access";
import { esSuperadmin, puedeVerPlataforma } from "@/lib/domain/acceso";
import { createClient } from "@/lib/supabase/server";

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

  const isMember = session.memberships.some((m) => m.business?.slug === slug);

  // Plataforma (superadmin o Soporte) sin membresía: modo soporte con motivo y vencimiento.
  // Solo lectura para Soporte; el superadministrador también puede abrirlo en modo edición (migración 0027).
  if (!isMember && puedeVerPlataforma(session.profile)) {
    const supabase = await createClient();
    const { data: biz } = await supabase.from("businesses").select("id, name").eq("slug", slug).maybeSingle();
    if (!biz) return <NoAccess />;
    const { data: abierta } = await supabase
      .from("support_sessions")
      .select("expires_at, mode")
      .eq("profile_id", session.user.id)
      .eq("business_id", biz.id)
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!abierta) {
      // Superadministrador: sin formulario ni motivo, un clic y entra con acceso completo.
      if (esSuperadmin(session.profile)) return <EntradaSuperadmin businessId={biz.id} slug={slug} name={biz.name} />;
      return <SupportEntry businessId={biz.id} slug={slug} name={biz.name} />;
    }

    const snapshot = await loadBusinessSnapshot(slug, session);
    if (!snapshot) return <NoAccess />;
    const modo = abierta.mode === "edit" && esSuperadmin(session.profile) ? "edit" : "read";
    return (
      <LiveProvider snapshot={{ ...snapshot, supportView: { expiresAt: abierta.expires_at, modo } }}>
        <BusinessShell slug={slug}>{children}</BusinessShell>
      </LiveProvider>
    );
  }

  // RLS: si el usuario no es miembro, el comercio simplemente no aparece.
  const snapshot = await loadBusinessSnapshot(slug, session);
  if (!snapshot || !isMember) return <NoAccess suspendida={!!session.profile?.suspendedAt} />;

  return (
    <LiveProvider snapshot={snapshot}>
      <BusinessShell slug={slug}>{children}</BusinessShell>
    </LiveProvider>
  );
}
