import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PERMISOS_COMERCIO_TEXTO, PERMISOS_PLATAFORMA, ROLES_COMERCIO, ROLES_PLATAFORMA } from "@/lib/domain/acceso";
import { can, type Permission } from "@/lib/domain/permissions";
import type { BusinessRole, PlatformRole } from "@/lib/domain/types";
import { Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Roles y permisos" };

const Si = () => (
  <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-bg text-success" title="Sí">
    <Check className="size-3.5" strokeWidth={2.5} aria-label="Sí" />
  </span>
);
const No = () => (
  <span className="inline-flex size-6 items-center justify-center text-subtle" title="No">
    <Minus className="size-3.5" aria-label="No" />
  </span>
);

const PLATAFORMA: PlatformRole[] = ["superadmin", "support", "user"];
const COMERCIO: BusinessRole[] = ["owner", "admin", "staff"];

/** Qué puede hacer cada rol. Es la regla que aplica la base de datos (no solo lo que muestra la pantalla). */
export default function RolesPage() {
  return (
    <>
      <PageHeader
        title="Roles y permisos"
        description="Cada permiso lo comprueba la base de datos en cada operación: ocultar un botón no basta para saltarse una regla."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Plataforma" description="Personas del equipo de Lazo. Se asigna desde la ficha de cada usuario." />
          <div className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
            {PLATAFORMA.map((r) => (
              <div key={r} className="bg-surface px-5 py-4">
                <p className="text-sm font-semibold text-coal">{ROLES_PLATAFORMA[r].nombre}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{ROLES_PLATAFORMA[r].descripcion}</p>
              </div>
            ))}
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Permiso</Th>
                {PLATAFORMA.map((r) => (
                  <Th key={r} className="text-center">
                    {ROLES_PLATAFORMA[r].corto}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISOS_PLATAFORMA.map((p) => (
                <tr key={p.permiso}>
                  <Td>
                    <span className="block min-w-48 whitespace-normal">{p.permiso}</span>
                  </Td>
                  {PLATAFORMA.map((r) => (
                    <Td key={r} className="text-center">
                      {p[r] ? <Si /> : <No />}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Dentro de cada comercio" description="Lo asigna el propietario o un administrador del comercio, o un superadministrador desde la ficha del usuario." />
          <div className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
            {COMERCIO.map((r) => (
              <div key={r} className="bg-surface px-5 py-4">
                <p className="text-sm font-semibold text-coal">{ROLES_COMERCIO[r].nombre}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{ROLES_COMERCIO[r].descripcion}</p>
              </div>
            ))}
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Permiso</Th>
                {COMERCIO.map((r) => (
                  <Th key={r} className="text-center">
                    {ROLES_COMERCIO[r].nombre}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISOS_COMERCIO_TEXTO) as Permission[]).map((p) => (
                <tr key={p}>
                  <Td>
                    <span className="block min-w-40 whitespace-normal">{PERMISOS_COMERCIO_TEXTO[p]}</span>
                  </Td>
                  {COMERCIO.map((r) => (
                    <Td key={r} className="text-center">
                      {p === "rewards.redeem" && r === "staff" ? (
                        <span className="text-xs text-muted">Si se le permite</span>
                      ) : can({ role: r, canRedeem: false }, p) ? (
                        <Si />
                      ) : (
                        <No />
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card className="p-5 text-[13px] leading-relaxed text-muted">
          <p>
            <strong className="text-ink">Reglas que siempre se cumplen:</strong> nadie cambia su propio rol ni se suspende a sí mismo; siempre queda al menos un superadministrador
            activo; un comercio tiene un solo propietario; una cuenta suspendida no ve ningún dato; y nadie del panel ve ni escribe contraseñas.
          </p>
        </Card>
      </div>
    </>
  );
}
