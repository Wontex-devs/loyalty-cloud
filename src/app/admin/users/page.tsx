"use client";

import { InviteAdmin } from "@/components/admin/invite-admin";
import { RevokeAdmin } from "@/components/admin/revoke-admin";
import { useDemo } from "@/lib/demo/store";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { Avatar, Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function UsersPage() {
  const { state } = useDemo();
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso a paneles. Los clientes finales no tienen cuenta."
        actions={<InviteAdmin />}
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Usuario</Th>
              <Th>Rol de plataforma</Th>
              <Th>Comercios</Th>
              <Th>Alta</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {state.profiles.map((p) => {
              const ms = state.memberships.filter((m) => m.profileId === p.id);
              return (
                <tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.fullName} />
                      <div>
                        <p className="font-medium">{p.fullName}</p>
                        <p className="text-xs text-muted">{p.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{p.platformRole === "superadmin" ? <Badge tone="brand">Superadministrador</Badge> : <span className="text-muted">Usuario</span>}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {ms.length === 0 && <span className="text-muted">—</span>}
                      {ms.map((m) => (
                        <Badge key={m.id}>
                          {state.businesses.find((b) => b.id === m.businessId)?.name} · {ROLE_LABELS[m.role]}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-muted">{formatDate(p.createdAt)}</Td>
                  <Td>{p.platformRole === "superadmin" ? <RevokeAdmin profileId={p.id} nombre={p.fullName} /> : <span className="text-muted">—</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
