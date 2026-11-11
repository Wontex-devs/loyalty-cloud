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
  Settings,
  Sparkles,
  Tag,
  UserCog,
  Users,
} from "lucide-react";
import { onboardingSteps } from "./onboarding";
import { AppShell, type NavSection } from "@/components/layout/app-shell";
import { useBusiness, type BusinessScope } from "@/lib/data/store";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { Avatar, ButtonLink, EmptyState } from "@/components/ui";
import { AlertTriangle, Lock } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
    ...(can(m, "program.edit")
      ? [
          { href: `${base}/promotions`, label: "Promociones", icon: Tag },
          { href: `${base}/campaigns`, label: "Campañas", icon: Megaphone },
        ]
      : []),
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
        { href: `${base}/customers`, label: "Clientes", icon: Users },
        ...(can(m, "rewards.redeem") || can(m, "analytics.read") ? [{ href: `${base}/rewards`, label: "Recompensas", icon: Gift }] : []),
      ],
    },
    ...(can(m, "program.edit")
      ? [
          {
            title: "Mi programa",
            items: [
              ...(!onboardingSteps(scope).complete ? [{ href: `${base}/onboarding`, label: "Primeros pasos", icon: ListChecks }] : []),
              { href: `${base}/card-design`, label: "Tarjeta, QR y NFC", icon: CreditCard },
              { href: `${base}/program`, label: "Sellos y premio", icon: Sparkles },
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

  const footer = (
    <div className="flex items-center gap-2.5 rounded-lg p-1.5">
      <Avatar name={scope.actingProfile?.fullName ?? "?"} className="size-7" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{scope.actingProfile?.fullName}</p>
        <p className="truncate text-xs text-muted">
          {membership ? ROLE_LABELS[membership.role] : "Sin acceso"}
          {membership?.role === "staff" && (membership.canRedeem ? " · puede canjear" : " · sin canjes")}
        </p>
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
