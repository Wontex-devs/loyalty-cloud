"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { entrarComoSuperadminAction, type SupportState } from "@/lib/data/support-actions";
import { Button } from "@/components/ui";

/** Botón de un clic para que el superadministrador entre a un comercio con acceso completo. */
export function EntrarComercioBoton({
  businessId,
  slug,
  texto = "Entrar al comercio",
  principal = false,
  className,
}: {
  businessId: string;
  slug: string;
  texto?: string;
  principal?: boolean;
  className?: string;
}) {
  const [state, action, pending] = useActionState<SupportState, FormData>(() => entrarComoSuperadminAction(businessId, slug), null);
  return (
    <form action={action} className={className}>
      <Button type="submit" variant={principal ? "primary" : "secondary"} disabled={pending} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} {texto}
      </Button>
      {state?.error && <p className="mt-1.5 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
