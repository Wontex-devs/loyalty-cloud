"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  ExternalLink,
  Gift,
  History,
  ListChecks,
  LayoutDashboard,
  Megaphone,
  ScanBarcode,
  Settings,
  Sparkles,
  Tag,
  UserCog,
  Users,
} from "lucide-react";
import { onboardingSteps } from "./onboarding";
import { AppShell, type NavSection } from "@/components/layout/app-shell";
import { useBusiness, useData, type BusinessScope } from "@/lib/data/store";
import { endSupportSessionAction } from "@/lib/data/support-actions";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { Avatar, ButtonLink, EmptyState } from "@/components/ui";
import { AlertTriangle, Eye, Lock, PencilLine } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MiNombre } from "./mi-nombre";
import { faltaNombre } from "@/lib/domain/nombre";
import { BrandMark } from "@/components/loyalty/brand-mark";

const ScopeCtx = createContext<BusinessScope | null>(null);

/** Acceso al tenant actual. Todas las pantallas del panel leen datos desde aquí. */
export function useScope() {
  const s = useContext(ScopeCtx);
  if (!s) throw new Error("useScope fuera de BusinessShell");
  return s;
}

export function BusinessShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const scope = useBusiness(slug);
  const supportView = useData().state.supportView;

  if (!scope) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState icon={AlertTriangle} title="Comercio no encontrado" action={<ButtonLink href="/login">Volver</ButtonLink>} />
      </div>
    );
  }

  const { business, membership } = scope;
  const base = `/business/${slug}`;
  const m = membership ?? { role: "staff" as const, canRedeem: false };

  // Solo lo del día a día a la vista; lo demás queda en «Más opciones».
  const masOpciones = [
    ...(can(m, "analytics.read") ? [{ href: `${base}/history`, label: "Historial", icon: History }] : []),
    ...(can(m, "program.edit") ? [{ href: `${base}/promotions`, label: "Promociones", icon: Tag }] : []),
    ...(can(m, "staff.manage")
      ? [
          { href: `${base}/staff`, label: "Empleados", icon: UserCog },
          { href: `${base}/analytics`, label: "Estadísticas", icon: BarChart3 },
        ]
      : []),
    ...(can(m, "settings.edit") ? [{ href: `${base}/settings`, label: "Configuración", icon: Settings }] : []),
  ];

  const sections: NavSection[] = [
    {
      items: [
        ...(can(m, "analytics.read") ? [{ href: base, label: "Inicio", icon: LayoutDashboard, exact: true }] : []),
        ...(can(m, "visits.create") ? [{ href: `${base}/escanear`, label: "Escanear tarjeta", icon: ScanBarcode }] : []),
        { href: `${base}/customers`, label: "Clientes", icon: Users },
        ...(can(m, "rewards.redeem") || can(m, "analytics.read") ? [{ href: `${base}/rewards`, label: "Recompensas", icon: Gift }] : []),
      ],
    },
    ...(can(m, "program.edit")
      ? [
          {
            title: "Mi tarjeta",
            items: [
              ...(!onboardingSteps(scope).complete ? [{ href: `${base}/onboarding`, label: "Primeros pasos", icon: ListChecks }] : []),
              { href: `${base}/card-design`, label: "Tarjeta, QR y NFC", icon: CreditCard },
              { href: `${base}/program`, label: "Sellos y premio", icon: Sparkles },
              { href: `${base}/campaigns`, label: "Notificaciones", icon: Megaphone },
            ],
          },
        ]
      : []),
    ...(masOpciones.length ? [{ title: "Más opciones", items: masOpciones, collapsible: true }] : []),
  ];

  const header = (
    <>
      <LazoLogo className="mb-2 px-1.5 pt-1 text-[22px] text-coal" markClassName="text-cobalt" />
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
      <BrandMark
        branding={business.branding}
        className="size-8 rounded-lg border border-line font-serif text-sm"
        style={{ background: business.branding.primary, color: business.branding.primaryForeground }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{business.name}</p>
        <p className="truncate text-xs text-muted">{business.category}</p>
      </div>
    </div>
    </>
  );

  // Si la cuenta no tiene nombre (se guardó el correo), se muestra el correo solo en el pie, sin partirlo.
  const nombreVisible = scope.actingProfile?.fullName || "?";

  const footer = (
    <div className="flex items-center gap-2.5 rounded-lg p-1.5">
      <Avatar name={nombreVisible} className="size-7" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{nombreVisible}</p>
        <p className="truncate text-xs text-muted">
          {supportView ? (supportView.modo === "edit" ? "Superadministrador · edición" : "Soporte · solo lectura") : membership ? ROLE_LABELS[membership.role] : "Sin acceso"}
          {membership?.role === "staff" && (membership.canRedeem ? " · puede canjear" : " · sin canjes")}
        </p>
        {!supportView && scope.actingProfile && (
          <MiNombre profileId={scope.actingProfile.id} actual={scope.actingProfile.fullName} faltante={faltaNombre(scope.actingProfile.fullName)} />
        )}
      </div>
    </div>
  );

  const topbar = (
    <>
      <span className="mr-auto hidden sm:block">
      </span>
      <ButtonLink href={`/join/${slug}`} target="_blank" variant="ghost" size="sm">
        <span className="hidden sm:inline">Página de registro</span> <ExternalLink className="size-3.5" />
      </ButtonLink>
      <SignOutButton />
    </>
  );

  const brandVars = {
    "--brand": business.branding.primary,
    "--brand-fg": business.branding.primaryForeground,
    "--brand-accent": business.branding.accent,
  } as React.CSSProperties;

  return (
    <AppShell header={header} sections={sections} footer={footer} topbar={topbar} style={brandVars}>
      {!membership ? (
        <EmptyState icon={Lock} title="Sin acceso a este comercio" description="Tu usuario no tiene una membresía activa en este establecimiento." />
      ) : (
        <ScopeCtx.Provider value={scope}>
          {supportView?.modo === "edit" && (
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-cobalt/20 bg-cobalt/5 px-4 py-2.5 text-sm text-ink-2">
              <PencilLine className="size-4 shrink-0 text-cobalt" />
              <span className="flex-1">
                Estás dentro de <strong>{business.name}</strong> como superadministrador. Tus cambios son reales y quedan en su historial.
              </span>
              <form action={endSupportSessionAction.bind(null, business.id)}>
                <button className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium hover:bg-canvas">Volver a la plataforma</button>
              </form>
            </div>
          )}
          {supportView && supportView.modo !== "edit" && (
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
              <Eye className="size-4 shrink-0" />
              <span className="flex-1">
                <strong>Modo soporte: solo lectura.</strong> Ves el panel como {business.name}; no se puede cambiar nada. Vence a las{" "}
                {new Date(supportView.expiresAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}.
              </span>
              <form action={endSupportSessionAction.bind(null, business.id)}>
                <button className="rounded-md border border-warning/40 px-2.5 py-1 text-xs font-medium hover:bg-warning/10">Salir del modo soporte</button>
              </form>
            </div>
          )}
          {business.status === "suspended" && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
              <AlertTriangle className="size-4" /> Este establecimiento está suspendido. Las tarjetas no aceptan nuevas visitas.
            </div>
          )}
          {children}
        </ScopeCtx.Provider>
      )}
    </AppShell>
  );
}

/** Guardia de permisos para páginas completas. */
export function RequirePermission({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  if (allowed) return <>{children}</>;
  return (
    <EmptyState
      icon={Lock}
      title="No tienes permiso para ver esta sección"
      description="Pide a un administrador del comercio que ajuste tu rol."
      action={
        <Link href="customers" className="text-sm font-medium underline">
          Ir a clientes
        </Link>
      }
    />
  );
}
