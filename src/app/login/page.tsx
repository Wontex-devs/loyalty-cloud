import type { Metadata } from "next";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión", description: "Entra al panel de tu negocio en Lazo." };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2">
          <LazoLogo animar className="text-[32px] text-coal" markClassName="text-cobalt" />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-[family-name:var(--font-poster)] text-4xl font-extrabold tracking-[-0.02em] text-coal">Inicia sesión</h1>
          <p className="mt-1 text-sm text-muted">Accede al panel de tu negocio.</p>

          <LoginForm />
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-cobalt lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: "radial-gradient(circle, rgb(255 255 255 / 0.16) 10px, transparent 10.5px)",
            backgroundSize: "44px 44px",
          }}
        />
        <p
          aria-hidden
          className="absolute -right-6 top-24 flex size-40 rotate-12 items-center justify-center rounded-full bg-sun p-4 text-center font-[family-name:var(--font-poster)] text-2xl font-extrabold leading-[1.05] text-coal"
        >
          Un sello más y es tuyo
        </p>
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="font-[family-name:var(--font-poster)] text-7xl font-extrabold leading-[0.95] tracking-[-0.02em]">
            Clientes que <span className="text-sun">vuelven,</span>
            <br />
            sin descargar apps.
          </p>
          <p className="mt-5 max-w-md text-base text-white/85">
            Tarjetas de fidelización digitales con la identidad de cada negocio. Un QR para inscribirse, un QR para sumar visitas.
          </p>
        </div>
      </div>
    </div>
  );
}
