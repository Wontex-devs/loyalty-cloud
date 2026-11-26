"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock, MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { estadoPagoAction } from "@/lib/data/pagos-actions";
import { accesoCortado, DIAS_GRACIA_COBRO, fechaCorta } from "@/lib/domain/cobros";
import { SALES_WHATSAPP } from "@/lib/config";
import { PagoPlanCard } from "./pago-plan-card";

/** Secciones que siguen abiertas con el panel bloqueado: sumar sellos y la página a la que vuelve el pago. */
const SIEMPRE_ABIERTAS = ["/escanear", "/settings"];

/**
 * Corte por mora: pasados los días de gracia, el dueño o administrador ve la pantalla de pago en
 * vez de su panel. Al pagar se abre solo. Los empleados no ven el cobro (el servidor no se lo
 * entrega) y siguen sumando sellos; las tarjetas de los clientes no se tocan.
 */
export function CortePorMora({
  businessId,
  businessName,
  slug,
  children,
}: {
  businessId: string;
  businessName: string;
  slug: string;
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  const [corte, setCorte] = useState<{ pagadoHasta: string } | null>(null);
  // Mientras esté bloqueado se vuelve a consultar en cada cambio de sección, para abrir apenas pague.
  const revisar = corte ? ruta : "";

  useEffect(() => {
    let vivo = true;
    estadoPagoAction(businessId)
      .then((r) => {
        if (!vivo || !r.ok) return;
        setCorte(accesoCortado(r.estado) && r.estado.pagadoHasta ? { pagadoHasta: r.estado.pagadoHasta } : null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [businessId, revisar]);

  const abierta = SIEMPRE_ABIERTAS.some((s) => ruta === `/business/${slug}${s}` || ruta.startsWith(`/business/${slug}${s}/`));
  if (!corte || abierta) return <>{children}</>;
  return <CortePorMoraVista pagadoHasta={corte.pagadoHasta} businessId={businessId} businessName={businessName} />;
}

/** Lo que se ve con el panel bloqueado. */
export function CortePorMoraVista({ pagadoHasta, businessId, businessName }: { pagadoHasta: string; businessId: string; businessName: string }) {
  const whatsapp = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero pagar el plan de Lazo de ${businessName}.`)}`;
  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <div className="text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-danger-bg text-danger">
          <Lock className="size-5" />
        </span>
        <h1 className="mt-3 text-lg font-semibold">Tu panel está en pausa</h1>
        <p className="mt-1 text-sm text-muted">
          Tu plan estaba pagado hasta el {fechaCorta(pagadoHasta)} y ya pasaron los {DIAS_GRACIA_COBRO} días de plazo. Paga para volver a entrar: se abre
          apenas quede aprobado.
        </p>
        <p className="mt-2 text-sm text-muted">Tus clientes conservan sus tarjetas y sus sellos. No se borra nada.</p>
      </div>
      <PagoPlanCard businessId={businessId} />
      <div className="text-center">
        <ButtonLink href={whatsapp} target="_blank" rel="noopener" variant="secondary" size="sm">
          <MessageCircle className="size-4" /> ¿Ya pagaste o necesitas ayuda? Escríbenos
        </ButtonLink>
      </div>
    </div>
  );
}
