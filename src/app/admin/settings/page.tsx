"use client";

import { useDemo } from "@/lib/demo/store";
import { PLATFORM_NAME, PUBLIC_HOST_LABEL } from "@/lib/config";
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Switch } from "@/components/ui";

export default function PlatformSettingsPage() {
  const { reset, mode } = useDemo();
  return (
    <>
      <PageHeader title="Configuración" description="Parámetros globales de la plataforma." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Marca de la plataforma" />
          <div className="grid gap-4 p-5">
            <Field label="Nombre">
              <Input defaultValue={PLATFORM_NAME} />
            </Field>
            <Field label="Dominio público" hint="Usado en /join y /card">
              <Input defaultValue={PUBLIC_HOST_LABEL} className="font-mono" />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Valores por defecto para nuevos comercios" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="País / prefijo telefónico">
              <Select defaultValue="57">
                <option value="57">Colombia (+57)</option>
                <option value="52">México (+52)</option>
                <option value="34">España (+34)</option>
              </Select>
            </Field>
            <Field label="Días de prueba">
              <Input type="number" defaultValue={14} />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
              Exigir verificación de teléfono (OTP) en el registro
              <Switch checked={false} onChange={() => {}} />
            </label>
          </div>
        </Card>
      </div>
      {mode === "demo" && (
      <Card className="mt-4">
        <CardHeader title="Prototipo" description="Restablece todos los datos de demostración." />
        <div className="p-5">
          <Button variant="secondary" onClick={reset}>
            Restablecer datos demo
          </Button>
        </div>
      </Card>
      )}
    </>
  );
}
