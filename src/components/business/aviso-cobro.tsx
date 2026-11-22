"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Gift, MessageCircle, X } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { estadoPagoAction } from "@/lib/data/pagos-actions";
import { avisoCobro, type AvisoCobro } from "@/lib/domain/cobros";
import { SALES_WHATSAPP } from "@/lib/config";
import { cn } from "@/lib/utils";

const ESTILO: Record<AvisoCobro["tono"], { caja: string; icono: typeof Gift }> = {
  info: { caja: "border-cobalt/20 bg-cobalt/5 text-ink-2", icono: Gift },
  warning: { caja: "border-warning/30 bg-warning-bg text-ink-2", icono: CalendarClock },
  danger: { caja: "border-danger/25 bg-danger-bg text-ink-2", icono: AlertTriangle },
};

const leer = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: el aviso vuelve a salir */
  }
};

/**
 * Aviso de cobro arriba del panel, solo para el propietario o administrador (los empleados no ven
 * el cobro). Se puede cerrar por hoy; al día siguiente vuelve a salir mientras siga pendiente.
 */
export function AvisoCobroBanner({ businessId, businessName, slug }: { businessId: string; businessName: string; slug: string }) {
  const [aviso, setAviso] = useState<AvisoCobro | null>(null);
  const [enLinea, setEnLinea] = useState(false);
  const [cerrado, setCerrado] = useState(false);
  const clave = `lazo-aviso-cobro:${businessId}`;

  useEffect(() => {
    let vivo = true;
    estadoPagoAction(businessId)
      .then((r) => {
        if (!vivo || !r.ok) return;
        const a = avisoCobro({ pagadoHasta: r.estado.pagadoHasta, mesGratisPendiente: r.estado.mesGratisPendiente, planId: r.estado.planId });
        setAviso(a);
        setEnLinea(r.estado.disponible);
        setCerrado(!!a && leer(clave) === a.clave);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [businessId, clave]);

  if (!aviso || cerrado) return null;
  return (
    <AvisoCobroVista
      aviso={aviso}
      enLinea={enLinea}
      businessName={businessName}
      slug={slug}
      onCerrar={() => {
        guardar(clave, aviso.clave);
        setCerrado(true);
      }}
    />
  );
}

/** Lo que se ve del aviso (sin cargar datos). */
export function AvisoCobroVista({
  aviso,
  enLinea,
  businessName,
  slug,
  onCerrar,
}: {
  aviso: AvisoCobro;
  enLinea: boolean;
  businessName: string;
  slug: string;
  onCerrar: () => void;
}) {
  const { caja, icono: Icono } = ESTILO[aviso.tono];
  const whatsapp = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero pagar el plan de Lazo de ${businessName}.`)}`;

  return (
    <div role="status" className={cn("mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm", caja)}>
      <Icono className={cn("size-4 shrink-0", aviso.tono === "danger" ? "text-danger" : aviso.tono === "warning" ? "text-warning" : "text-cobalt")} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{aviso.titulo}</p>
        <p className="text-muted">{aviso.texto}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {enLinea ? (
          <ButtonLink href={`/business/${slug}/settings#plan`} size="sm" variant={aviso.tono === "danger" ? "primary" : "secondary"}>
            Pagar ahora
          </ButtonLink>
        ) : (
          <ButtonLink href={whatsapp} target="_blank" rel="noopener" size="sm" variant={aviso.tono === "danger" ? "primary" : "secondary"}>
            <MessageCircle className="size-4" /> Pagar por WhatsApp
          </ButtonLink>
        )}
        <button
          type="button"
          aria-label="Cerrar el aviso por hoy"
          title="Cerrar por hoy"
          className="rounded-md p-1.5 text-muted hover:bg-black/5"
          onClick={onCerrar}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
