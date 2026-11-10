"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteBusinessAction } from "@/lib/data/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";

/**
 * Zona de peligro del comercio: lo elimina con todos sus datos. Hay que escribir su identificador para confirmar.
 * Solo en la versión real.
 */
export function DeleteBusiness({ businessId, slug, nombre }: { businessId: string; slug: string; nombre: string }) {
  const router = useRouter();
  const [escrito, setEscrito] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coincide = escrito.trim() === slug;

  const eliminar = async () => {
    if (!coincide) return;
    setTrabajando(true);
    setError(null);
    try {
      const r = await deleteBusinessAction(businessId, escrito);
      if (r.ok) {
        router.push("/admin/businesses");
        router.refresh();
        return;
      }
      setError(r.message);
    } catch {
      setError("No pudimos conectar. Inténtalo de nuevo.");
    }
    setTrabajando(false);
  };

  return (
    <Card className="mt-4 border-danger/40">
      <CardHeader
        title="Eliminar comercio"
        description={`Borra ${nombre} con todos sus datos: clientes, tarjetas, visitas, canjes, sedes, equipo y logo. Las tarjetas de sus clientes dejan de funcionar. No se puede deshacer.`}
      />
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <Field label={`Para confirmar, escribe el identificador: ${slug}`} className="flex-1">
          <Input
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            placeholder={slug}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            disabled={!isSupabaseConfigured}
          />
        </Field>
        <Button
          variant="danger"
          onClick={() => void eliminar()}
          disabled={!isSupabaseConfigured || !coincide || trabajando}
          title={isSupabaseConfigured ? undefined : "Funciona en la versión real, no en la demostración"}
        >
          {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Eliminar para siempre
        </Button>
      </div>
      {error && <p className="px-5 pb-5 text-sm text-danger">{error}</p>}
    </Card>
  );
}
