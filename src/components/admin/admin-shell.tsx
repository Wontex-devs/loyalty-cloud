"use client";

import { BarChart3, LayoutDashboard, Layers, ScrollText, Settings, ShieldCheck, Store, Users } from "lucide-react";
import { AppShell, type NavSection } from "@/components/layout/app-shell";
import { useData } from "@/lib/data/store";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ProveedorRol } from "@/components/admin/piezas";
import { ROLES_PLATAFORMA } from "@/lib/domain/acceso";
import type { PlatformRole } from "@/lib/domain/types";

const sections: NavSection[] = [
  {
    items: [
      { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
      { href: "/admin/businesses", label: "Establecimientos", icon: Store },
      { href: "/admin/users", label: "Usuarios", icon: Users },
      { href: "/admin/plans", label: "Planes", icon: Layers },
      { href: "/admin/analytics", label: "Estadísticas", icon: BarChart3 },
    ],
  },
  {
    title: "Seguridad",
    items: [
      { href: "/admin/audit", label: "Auditoría", icon: ScrollText },
      { href: "/admin/roles", label: "Roles y permisos", icon: ShieldCheck },
    ],
  },
  { title: "Sistema", items: [{ href: "/admin/settings", label: "Configuración", icon: Settings }] },
];

/** Colores de Lazo para los componentes que usan el color de marca (gráficos, etiquetas). Antes salían en negro y rosado. */
const MARCA_LAZO = { "--brand": "#1b3fd8", "--brand-fg": "#ffffff", "--brand-accent": "#1b3fd8" } as React.CSSProperties;

export function AdminShell({ rol, children }: { rol: PlatformRole; children: React.ReactNode }) {
  const { state } = useData();
  const me = state.profiles.find((p) => p.id === state.actingProfileId);
  return (
    <AppShell
      style={MARCA_LAZO}
      sections={sections}
      header={
        <div className="flex items-baseline gap-2.5 px-1.5 py-1.5">
          <LazoLogo className="text-[26px] text-coal" markClassName="text-cobalt" />
          <p className="text-xs text-muted">Plataforma</p>
        </div>
      }
      footer={
        <div className="flex items-center gap-2.5 p-1.5">
          <Avatar name={me?.fullName ?? "SA"} className="size-7" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{me?.fullName}</p>
            <p className="text-xs text-muted">{ROLES_PLATAFORMA[rol].nombre}</p>
          </div>
        </div>
      }
      topbar={
        <>
          <span className="mr-auto" />
          {rol === "support" && (
            <span className="mr-2 rounded-md bg-info-bg px-2 py-1 text-xs font-medium text-info">Modo solo lectura</span>
          )}
          <SignOutButton />
        </>
      }
    >
      <ProveedorRol rol={rol}>{children}</ProveedorRol>
    </AppShell>
  );
}
