"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, PencilLine } from "lucide-react";
import { startSupportSessionAction, type SupportState } from "@/lib/data/support-actions";
import { Button, Field, Segmented, Select, Textarea } from "@/components/ui";

type Modo = "read" | "edit";

/**
 * Antes de entrar al panel de un comercio, la plataforma escribe por qué entra.
 * Soporte solo puede leer. El superadministrador puede elegir entrar a editar con permisos de propietario.
 * El acceso vence solo y el comercio lo ve en su historial.
 */
export function SupportEntry({ businessId, slug, name, puedeEditar = false }: { businessId: string; slug: string; name: string; puedeEditar?: boolean }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(startSupportSessionAction, null);
  const [modo, setModo] = useState<Modo>("read");
  const editar = puedeEditar && modo === "edit";

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form action={action} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <Link href={`/admin/businesses/${businessId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver a la plataforma
        </Link>
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-canvas">
          {editar ? <PencilLine className="size-5 text-danger" /> : <Eye className="size-5 text-muted" />}
        </div>
        <h1 className="text-lg font-semibold">{editar ? `Editar ${name}` : `Ver como ${name}`}</h1>

        {puedeEditar && (
          <div className="mt-3">
            <Segmented<Modo>
              value={modo}
              onChange={setModo}
              options={[
                { value: "read", label: "Solo ver" },
                { value: "edit", label: "Ver y editar" },
              ]}
            />
          </div>
        )}

        {editar ? (
          <p className="mt-3 text-sm text-muted">
            Vas a entrar a su panel <strong className="text-danger">con permisos de propietario</strong>: puedes cambiar la tarjeta, el programa, las sedes, el
            equipo, los clientes, las campañas y registrar visitas. Los cambios son reales. Tu entrada, el motivo y cada cambio quedan a tu nombre en la
            auditoría, y el comercio los ve en su historial.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Vas a ver su panel tal como lo ve el comercio, incluidos los datos de sus clientes, <strong>solo para leer</strong>: no se puede cambiar nada.
            Tu entrada y el motivo quedan en la auditoría, y el comercio los ve en su historial.
          </p>
        )}

        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="mode" value={editar ? "edit" : "read"} />
        <div className="mt-5 space-y-4">
          <Field
            label="Motivo"
            hint={editar ? "Por ejemplo: «El dueño pidió cambiar el premio de la tarjeta»." : "Por ejemplo: «El comercio reporta que no ve las visitas de ayer»."}
          >
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
        <Button type="submit" variant={editar ? "danger" : "primary"} className="mt-5 w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : editar ? <PencilLine className="size-4" /> : <Eye className="size-4" />}
          {editar ? " Entrar a editar" : " Entrar en modo solo lectura"}
        </Button>
      </form>
    </div>
  );
}
