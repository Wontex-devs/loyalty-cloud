import { PLATFORM_NAME, PUBLIC_HOST_LABEL, SALES_WHATSAPP } from "@/lib/config";
import { Card, CardHeader, PageHeader } from "@/components/ui";

/** Datos fijos de la plataforma. Se cambian en el código o en las variables de entorno de Vercel. */
export default function PlatformSettingsPage() {
  const datos = [
    ["Nombre", PLATFORM_NAME],
    ["Dominio público", PUBLIC_HOST_LABEL],
    ["WhatsApp de ventas", `+${SALES_WHATSAPP}`],
  ];
  return (
    <>
      <PageHeader title="Configuración" description="Datos generales de la plataforma." />
      <Card>
        <CardHeader title="Marca de la plataforma" description="Para cambiarlos, pídeselo a quien mantiene el código." />
        <dl className="divide-y divide-line">
          {datos.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
