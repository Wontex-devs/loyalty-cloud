"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronsUpDown,
  CreditCard,
  ExternalLink,
  Gift,
  History,
  ListChecks,
  LayoutDashboard,
  Megaphone,
  ScanLine,
  Settings,
  Sparkles,
  Tag,
  UserCog,
  Users,
} from "lucide-react";
import { onboardingSteps } from "./onboarding";
import { AppShell, ShellSkeleton, type NavSection } from "@/components/layout/app-shell";
import { useBusiness, useDemo, type BusinessScope } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { Avatar, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { AlertTriangle, Lock } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

const ScopeCtx = createContext<BusinessScope | null>(null);

/** Acceso al tenant actual. Todas las pantallas del panel leen datos desde aquí. */
export function useScope() {
  const s = useContext(ScopeCtx);
  if (!s) throw new Error("useScope fuera de BusinessShell");
  return s;
}

export function BusinessShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { hydrated, state, setActingProfile, mode } = useDemo();
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

  const sections: NavSection[] = [
    {
      items: [
        ...(can(m, "analytics.read") ? [{ href: base, label: "Dashboard", icon: LayoutDashboard, exact: true }] : []),
        { href: `${base}/scan`, label: "Registrar visita", icon: ScanLine },
        { href: `${base}/customers`, label: "Clientes", icon: Users },
        ...(can(m, "rewards.redeem") || can(m, "analytics.read") ? [{ href: `${base}/rewards`, label: "Recompensas", icon: Gift }] : []),
        ...(can(m, "analytics.read") ? [{ href: `${base}/history`, label: "Historial", icon: History }] : []),
      ],
    },
    ...(can(m, "program.edit")
      ? [
          {
            title: "Programa",
            items: [
              ...(!onboardingSteps(scope).complete ? [{ href: `${base}/onboarding`, label: "Primeros pasos", icon: ListChecks }] : []),
              { href: `${base}/program`, label: "Mi programa", icon: Sparkles },
              { href: `${base}/card-design`, label: "Mi tarjeta digital", icon: CreditCard },
              { href: `${base}/promotions`, label: "Promociones", icon: Tag },
              { href: `${base}/campaigns`, label: "Campañas", icon: Megaphone },
            ],
          },
        ]
      : []),
    ...(can(m, "staff.manage")
      ? [
          {
            title: "Negocio",
            items: [
              { href: `${base}/staff`, label: "Empleados", icon: UserCog },
              { href: `${base}/analytics`, label: "Estadísticas", icon: BarChart3 },
              { href: `${base}/settings`, label: "Configuración", icon: Settings },
            ],
          },
        ]
      : []),
  ];

  const team = state.memberships.filter((x) => x.businessId === business.id && x.active);

  const header = (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
      <div
        className="flex size-8 items-center justify-center rounded-lg font-serif text-sm"
        style={{ background: business.branding.primary, color: business.branding.primaryForeground }}
      >
        {business.branding.logoText}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{business.name}</p>
        <p className="truncate text-xs text-muted">{business.category}</p>
      </div>
    </div>
  );

  const footer = (
    <label className="relative flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 hover:bg-black/[0.035]">
      <Avatar name={scope.actingProfile?.fullName ?? "?"} className="size-7" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{scope.actingProfile?.fullName}</p>
        <p className="truncate text-xs text-muted">
          {membership ? ROLE_LABELS[membership.role] : "Sin acceso"}
          {membership?.role === "staff" && (membership.canRedeem ? " · puede canjear" : " · sin canjes")}
        </p>
      </div>
      {mode === "demo" && <ChevronsUpDown className="size-3.5 text-subtle" />}
      {/* Selector de sesión simulada para probar permisos por rol (solo demo) */}
      {mode === "demo" && (
      <select
        aria-label="Cambiar usuario de demostración"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={state.actingProfileId}
        onChange={(e) => setActingProfile(e.target.value)}
      >
        {team.map((t) => {
          const p = state.profiles.find((x) => x.id === t.profileId);
          return (
            <option key={t.id} value={t.profileId}>
              {p?.fullName} — {ROLE_LABELS[t.role]}
            </option>
          );
        })}
      </select>
      )}
    </label>
  );

  const topbar = (
    <>
      <span className="mr-auto hidden sm:block">
        {mode === "demo" && <Badge tone="warning">Demostración · datos de ejemplo</Badge>}
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
      {!hydrated ? (
        <ShellSkeleton />
      ) : !membership ? (
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
        <Link href="scan" className="text-sm font-medium underline">
          Ir a registrar visita
        </Link>
      }
    />
  );
}
