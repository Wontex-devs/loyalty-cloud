"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard, QrCode, ScanLine, Shield, Store, UserPlus } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { DEMO_FEATURED_TOKEN } from "@/lib/demo/data";
import { PLATFORM_NAME } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/login-form";

const ROLES = [
  {
    icon: Shield,
    title: "Superadministrador",
    who: "Natalia Huertas · Plataforma",
    href: "/admin",
  },
  {
    icon: Store,
    title: "Administrador del comercio",
    who: "Valentina Ríos · Beauty Club",
    href: "/business/beautyclub",
    profile: "usr_owner",
  },
  {
    icon: ScanLine,
    title: "Empleado",
    who: "Laura Gómez · Beauty Club",
    href: "/business/beautyclub/scan",
    profile: "usr_staff1",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { setActingProfile } = useDemo();

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-ink text-white">
            <CreditCard className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">{PLATFORM_NAME}</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="mt-1 text-sm text-muted">Accede al panel de tu negocio.</p>

          {isSupabaseConfigured ? (
            <LoginForm />
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-xs text-muted">
              Demostración con datos de ejemplo: no necesitas contraseña. Elige cómo quieres recorrer la plataforma; nada de lo que hagas afecta datos reales.
            </p>
          )}

          {!isSupabaseConfigured && (
            <>
          <div className="my-8 flex items-center gap-3 text-xs text-subtle">
            <div className="h-px flex-1 bg-line" /> Demostración · entrar como <div className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-2">
            {ROLES.map((r) => (
              <button
                key={r.title}
                onClick={() => {
                  if (r.profile) setActingProfile(r.profile);
                  router.push(r.href);
                }}
                className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-card transition hover:border-line-strong hover:shadow-pop"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-canvas">
                  <r.icon className="size-4 text-ink-2" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted">{r.who}</p>
                </div>
                <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link href="/join/beautyclub" className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-xs font-medium text-ink-2 hover:bg-surface">
              <UserPlus className="size-3.5" /> Registro de cliente
            </Link>
            <Link href={`/card/${DEMO_FEATURED_TOKEN}`} className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-xs font-medium text-ink-2 hover:bg-surface">
              <QrCode className="size-3.5" /> Tarjeta de cliente
            </Link>
          </div>
            </>
          )}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-[#EBCFCB] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_10%,rgba(255,255,255,0.6),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-[#1A1416]">
          <p className="font-serif text-5xl leading-[1.05]">
            Clientes que vuelven,
            <br />
            sin descargar apps.
          </p>
          <p className="mt-4 max-w-md text-sm opacity-70">
            Tarjetas de fidelización digitales con la identidad de cada negocio. Un QR para inscribirse, un QR para sumar visitas.
          </p>
        </div>
      </div>
    </div>
  );
}
