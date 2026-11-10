"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
  /** Se muestra cerrada con un botón para desplegarla (se abre sola si estás en una de sus páginas). */
  collapsible?: boolean;
}

/** Shell común (sidebar + topbar) para el panel de plataforma y el panel del comercio. */
export function AppShell({
  header,
  sections,
  footer,
  topbar,
  children,
  style,
}: {
  header: React.ReactNode;
  sections: NavSection[];
  footer?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>({});
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2">{header}</div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {sections.map((section, i) => {
          const desplegada = !section.collapsible || abiertas[i] || section.items.some(isActive);
          return (
          <div key={i} className="mb-4">
            {section.collapsible ? (
              <button
                type="button"
                onClick={() => setAbiertas((a) => ({ ...a, [i]: !desplegada }))}
                aria-expanded={desplegada}
                className="mb-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted hover:bg-cobalt/[0.07] hover:text-coal"
              >
                <span className="flex-1 text-left">{section.title}</span>
                <ChevronDown className={cn("size-4 transition-transform duration-200", desplegada && "rotate-180")} aria-hidden />
              </button>
            ) : (
              section.title && <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-subtle uppercase">{section.title}</p>
            )}
            {desplegada && (
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors",
                        active ? "bg-cobalt text-white shadow-[0_6px_14px_-8px_rgb(27_63_216/0.7)]" : "text-ink-2 hover:bg-cobalt/[0.07] hover:text-coal",
                        item.soon && "text-subtle",
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-sun" : "text-muted")} strokeWidth={1.75} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.soon && (
                        <span className="rounded border border-line px-1 text-[10px] font-medium text-subtle">Pronto</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          );
        })}
      </nav>
      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </div>
  );

  return (
    <div className="min-h-dvh" style={style}>
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-canvas lg:block">{nav}</aside>

      {/* Sidebar móvil */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="animate-fade-up absolute inset-y-0 left-0 w-72 border-r border-line bg-canvas shadow-pop">
            <button className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-black/5" onClick={() => setOpen(false)} aria-label="Cerrar menú">
              <X className="size-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
          <button className="-ml-1 rounded-md p-1.5 hover:bg-black/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{topbar}</div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded bg-black/[0.06]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-black/[0.04]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-black/[0.04]" />
    </div>
  );
}
