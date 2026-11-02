"use client";

import { BarChart3, CreditCard, LayoutDashboard, Layers, Settings, Store, Users } from "lucide-react";
import { AppShell, ShellSkeleton, type NavSection } from "@/components/layout/app-shell";
import { useDemo } from "@/lib/demo/store";
import { PLATFORM_NAME } from "@/lib/config";
import { Avatar, Badge } from "@/components/ui";
import { SignOutButton } from "@/components/auth/sign-out-button";

const sections: NavSection[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/businesses", label: "Establecimientos", icon: Store },
      { href: "/admin/users", label: "Usuarios", icon: Users },
      { href: "/admin/plans", label: "Planes", icon: Layers },
      { href: "/admin/analytics", label: "Estadísticas", icon: BarChart3 },
    ],
  },
  { title: "Sistema", items: [{ href: "/admin/settings", label: "Configuración", icon: Settings }] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { hydrated, state, mode } = useDemo();
  const me = state.profiles.find((p) => p.id === state.actingProfileId) ?? state.profiles.find((p) => p.platformRole === "superadmin");
  return (
    <AppShell
      sections={sections}
      header={
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-ink text-white">
            <CreditCard className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{PLATFORM_NAME}</p>
            <p className="text-xs text-muted">Plataforma</p>
          </div>
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
          <span className="mr-auto hidden sm:block">
            {mode === "demo" && <Badge tone="warning">Demostración · datos de ejemplo</Badge>}
          </span>
          <SignOutButton />
        </>
      }
    >
      {hydrated ? children : <ShellSkeleton />}
    </AppShell>
  );
}
