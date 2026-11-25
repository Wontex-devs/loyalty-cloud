"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CreditCard, MessageCircle } from "lucide-react";
import { Badge, ButtonLink } from "@/components/ui";
import { estadoPagoAction, type EstadoPago } from "@/lib/data/pagos-actions";
import { ESTADOS_COBRO, estadoCobro, fechaCorta, textoVencimiento } from "@/lib/domain/cobros";
import { SALES_WHATSAPP } from "@/lib/config";
import { formatMoney } from "@/lib/utils";

/**
 * «Próximo pago» en el inicio del panel: hasta cuándo está pagado el plan y el botón para pagar,
 * siempre a la vista (no solo cuando está por vencer). Solo lo ve el propietario o un
 * administrador: a los empleados el servidor no les entrega el cobro y no se muestra nada.
 */
export function ProximoPago({ businessId, businessName, slug }: { businessId: string; businessName: string; slug: string }) {
  const [estado, setEstado] = useState<EstadoPago | null>(null);

  useEffect(() => {
    let vivo = true;
    estadoPagoAction(businessId)
      .then((r) => {
        if (vivo && r.ok) setEstado(r.estado);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [businessId]);

  if (!estado) return null;
  return <ProximoPagoVista estado={estado} businessName={businessName} slug={slug} />;
}

/** Lo que se ve (sin cargar datos). */
export function ProximoPagoVista({
  estado,
  businessName,
  slug,
}: {
  estado: Pick<EstadoPago, "disponible" | "pagadoHasta" | "planNombre" | "precioMensual">;
  businessName: string;
  slug: string;
}) {
  const cobro = estadoCobro(estado.pagadoHasta);
  const e = ESTADOS_COBRO[cobro];
  const urgente = cobro === "vencido" || cobro === "por-vencer";
  const whatsapp = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero pagar el plan de Lazo de ${businessName}.`)}`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-2">
        <CalendarClock className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">Próximo pago</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-semibold">{cobro === "sin-dato" ? "Aún sin fecha" : fechaCorta(estado.pagadoHasta)}</span>
          <Badge tone={e.tono} dot>
            {e.nombre}
          </Badge>
        </p>
        <p className="text-xs text-muted">
          Plan {estado.planNombre} · {formatMoney(estado.precioMensual)} al mes
          {cobro !== "sin-dato" && ` · ${textoVencimiento(estado.pagadoHasta)}`}
        </p>
      </div>
      {estado.disponible ? (
        <ButtonLink href={`/business/${slug}/settings#plan`} size="sm" variant={urgente ? "primary" : "secondary"} className="w-full sm:w-auto">
          <CreditCard className="size-4" /> Pagar ahora
        </ButtonLink>
      ) : (
        <ButtonLink href={whatsapp} target="_blank" rel="noopener" size="sm" variant={urgente ? "primary" : "secondary"} className="w-full sm:w-auto">
          <MessageCircle className="size-4" /> Pagar por WhatsApp
        </ButtonLink>
      )}
    </div>
  );
}
