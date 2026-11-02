"use client";

import { useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import type { Location, Plan } from "@/lib/domain/types";
import { Badge, Button, Card, CardHeader, Input } from "@/components/ui";

/** Sedes del comercio: alta, cambio de nombre y activación (según el plan). */
export function LocationsCard({ businessId, locations, plan }: { businessId: string; locations: Location[]; plan?: Plan }) {
  const { saveLocation } = useDemo();
  const [form, setForm] = useState<{ id?: string; name: string; address: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = locations.filter((l) => l.active).length;
  const full = !!plan?.maxLocations && active >= plan.maxLocations;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy("form");
    const current = locations.find((l) => l.id === form.id);
    const res = await saveLocation(businessId, { name: form.name, address: form.address || undefined, active: current?.active ?? true }, form.id);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    setError(null);
    setForm(null);
  };

  const toggle = async (l: Location) => {
    setBusy(l.id);
    const res = await saveLocation(businessId, { name: l.name, address: l.address, active: !l.active }, l.id);
    setBusy(null);
    setError(res.ok ? null : res.message);
  };

  return (
    <Card>
      <CardHeader
        title="Sedes"
        description={`Si tienes más de un local, el equipo elige la sede al registrar visitas y verás las estadísticas por sede. Tu plan permite ${plan?.maxLocations ?? "sedes ilimitadas"}${plan?.maxLocations ? (plan.maxLocations === 1 ? " sede activa" : " sedes activas") : ""}.`}
        action={
          !form && (
            <Button size="sm" variant="secondary" type="button" disabled={full} onClick={() => setForm({ name: "", address: "" })} title={full ? "Alcanzaste el límite de tu plan" : undefined}>
              <Plus className="size-3.5" /> Nueva sede
            </Button>
          )
        }
      />
      {error && <p className="border-b border-line bg-danger-bg px-5 py-2 text-sm text-danger">{error}</p>}
      {form && (
        <form onSubmit={save} className="grid gap-3 border-b border-line p-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <Input autoFocus placeholder="Nombre (ej.: Sede Norte)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Dirección (opcional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={busy === "form"}>
              {busy === "form" && <Loader2 className="size-3.5 animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      )}
      {locations.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">Sin sedes: todas las visitas cuentan para el comercio en general.</p>
      ) : (
        <ul className="divide-y divide-line">
          {locations.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <MapPin className="size-4 text-subtle" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {l.name} {!l.active && <Badge tone="neutral">Inactiva</Badge>}
                </p>
                {l.address && <p className="text-xs text-muted">{l.address}</p>}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ id: l.id, name: l.name, address: l.address ?? "" })}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy === l.id || (!l.active && full)} onClick={() => toggle(l)}>
                {busy === l.id && <Loader2 className="size-3.5 animate-spin" />} {l.active ? "Desactivar" : "Activar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
