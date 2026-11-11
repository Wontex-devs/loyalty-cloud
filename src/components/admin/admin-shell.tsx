"use client";

import { BarChart3, LayoutDashboard, Layers, Settings, Store, Users } from "lucide-react";
import { AppShell, type NavSection } from "@/components/layout/app-shell";
import { useData } from "@/lib/data/store";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "@/components/auth/sign-out-button";

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
  { title: "Sistema", items: [{ href: "/admin/settings", label: "Configuración", icon: Settings }] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state } = useData();
  const me = state.profiles.find((p) => p.id === state.actingProfileId);
  return (
    <AppShell
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
            <p className="text-xs text-muted">Superadministrador</p>
          </div>
        </div>
      }
      topbar={
        <>
          <span className="mr-auto" />
          <SignOutButton />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
