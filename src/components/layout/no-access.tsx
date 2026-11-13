import { Lock } from "lucide-react";
import { signOut } from "@/lib/data/actions";
import { ButtonLink } from "@/components/ui";

export function NoAccess({ suspendida = false }: { suspendida?: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-surface">
          <Lock className="size-5 text-muted" />
        </div>
        <h1 className="text-lg font-semibold">{suspendida ? "Cuenta suspendida" : "Sin acceso"}</h1>
        <p className="mt-1 text-sm text-muted">
          {suspendida
            ? "Tu cuenta está suspendida y por ahora no puede entrar a ningún panel. Si crees que es un error, escríbenos."
            : "Tu usuario no tiene permiso para ver esta sección. Pide a un administrador que te invite."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {!suspendida && <ButtonLink href="/start" variant="secondary">Ir a mi panel</ButtonLink>}
          <form action={signOut}>
            <button className="h-9 rounded-lg px-3.5 text-sm font-medium text-ink-2 hover:bg-black/[0.04]">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </div>
  );
}
