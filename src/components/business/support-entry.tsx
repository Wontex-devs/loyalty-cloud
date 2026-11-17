"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { startSupportSessionAction, type SupportState } from "@/lib/data/support-actions";
import { Button, Field, Select, Textarea } from "@/components/ui";

/**
 * Antes de ver el panel de un comercio, la plataforma escribe por qué entra.
 * El acceso es de solo lectura, vence solo y el comercio lo ve en su historial.
 */
export function SupportEntry({ businessId, slug, name }: { businessId: string; slug: string; name: string }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(startSupportSessionAction, null);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form action={action} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <Link href={`/admin/businesses/${businessId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver a la plataforma
        </Link>
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-canvas">
          <Eye className="size-5 text-muted" />
        </div>
        <h1 className="text-lg font-semibold">Ver como {name}</h1>
        <p className="mt-1 text-sm text-muted">
          Vas a ver su panel tal como lo ve el comercio, incluidos los datos de sus clientes, <strong>solo para leer</strong>: no se puede cambiar nada.
          Tu entrada y el motivo quedan en la auditoría, y el comercio los ve en su historial.
        </p>

        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="slug" value={slug} />
        <div className="mt-5 space-y-4">
          <Field label="Motivo" hint="Por ejemplo: «El comercio reporta que no ve las visitas de ayer».">
            <Textarea name="reason" required minLength={5} maxLength={300} rows={3} autoFocus />
          </Field>
          <Field label="Duración">
            <Select name="minutes" defaultValue="60">
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="120">2 horas</option>
            </Select>
          </Field>
        </div>
        {state?.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
        <Button type="submit" className="mt-5 w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Entrar en modo solo lectura
        </Button>
      </form>
    </div>
  );
}
