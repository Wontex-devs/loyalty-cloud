import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { EntrarComercioBoton } from "./entrar-comercio";

/**
 * Cuando el superadministrador abre un comercio sin tener el acceso abierto (por ejemplo, desde un enlace
 * o porque venció): un solo botón para entrar, sin formulario.
 */
export function EntradaSuperadmin({ businessId, slug, name }: { businessId: string; slug: string; name: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <Link href={`/admin/businesses/${businessId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver a la plataforma
        </Link>
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-canvas">
          <Store className="size-5 text-muted" />
        </div>
        <h1 className="text-lg font-semibold">{name}</h1>
        <p className="mt-1 text-sm text-muted">
          Entras con acceso completo, como el dueño, durante 2 horas. Tu entrada y tus cambios quedan en el historial del comercio.
        </p>
        <EntrarComercioBoton businessId={businessId} slug={slug} principal className="mt-5" />
      </div>
    </div>
  );
}
