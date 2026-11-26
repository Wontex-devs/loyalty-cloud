"use client";

import { RequirePermission, useScope } from "@/components/business/business-shell";
import { PagoPlanCard } from "@/components/business/pago-plan-card";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/domain/permissions";

/** «Pago del plan»: hasta cuándo está pagado y el botón para pagar en línea. Aquí vuelve el comercio después de pagar. */
export default function PagoPage() {
  const { business, membership } = useScope();
  return (
    <RequirePermission allowed={!!membership && can(membership, "settings.edit")}>
      <PageHeader title="Pago del plan" description="Mira hasta cuándo está pagado tu plan y págalo en línea." />
      <div className="max-w-md">
        <PagoPlanCard businessId={business.id} />
      </div>
    </RequirePermission>
  );
}
