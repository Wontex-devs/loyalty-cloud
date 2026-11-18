"use client";

import { useState } from "react";
import { Crosshair, Loader2, MapPin, Plus } from "lucide-react";
import { useData } from "@/lib/data/store";
import type { Location, Plan } from "@/lib/domain/types";
import { parseCoordinates } from "@/lib/wallet/geo";
import { Badge, Button, Card, CardHeader, Input } from "@/components/ui";

const coordsText = (l: { latitude?: number; longitude?: number }) => (l.latitude != null && l.longitude != null ? `${l.latitude}, ${l.longitude}` : "");
const mapUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

/** Sedes del comercio: alta, cambio de nombre, ubicación (aviso de cercanía) y activación (según el plan). */
export function LocationsCard({ businessId, locations, plan }: { businessId: string; locations: Location[]; plan?: Plan }) {
  const { saveLocation } = useData();
  const [form, setForm] = useState<{ id?: string; name: string; address: string; place: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = locations.filter((l) => l.active).length;
  const full = !!plan?.maxLocations && active >= plan.maxLocations;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const current = locations.find((l) => l.id === form.id);
    const coordinates = form.place.trim() ? parseCoordinates(form.place) : null;
    if (form.place.trim() && !coordinates) {
      return setError("No reconocemos esa ubicación. Pega las coordenadas (ej.: 4.6987, -74.0412) o el enlace completo de Google Maps.");
    }
    setBusy("form");
    const res = await saveLocation(businessId, { name: form.name, address: form.address || undefined, active: current?.active ?? true, coordinates }, form.id);
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

  const useHere = () => {
    if (!form || !navigator.geolocation) return setError("Este navegador no permite leer la ubicación.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setError(null);
        const r = (n: number) => Math.round(n * 1e6) / 1e6;
        setForm((f) => (f ? { ...f, place: `${r(pos.coords.latitude)}, ${r(pos.coords.longitude)}` } : f));
      },
      () => {
        setLocating(false);
        setError("No se pudo leer la ubicación. Revisa el permiso del navegador o pega las coordenadas.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const parsed = form?.place.trim() ? parseCoordinates(form.place) : null;

  return (
    <Card>
      <CardHeader
        title="Sedes"
        description={
          full
            ? `Si tienes más de un local, agrégalo aquí. Ya tienes el máximo de sedes activas de tu cuenta (${plan?.maxLocations}): escríbenos para ampliarlo.`
            : "Si tienes más de un local, agrégalo aquí."
        }
        action={
          !form && (
            <Button size="sm" variant="secondary" type="button" disabled={full} onClick={() => setForm({ name: "", address: "", place: "" })} title={full ? "Alcanzaste el máximo de sedes de tu cuenta" : undefined}>
              <Plus className="size-3.5" /> Nueva sede
            </Button>
          )
        }
      />
      {error && <p className="border-b border-line bg-danger-bg px-5 py-2 text-sm text-danger">{error}</p>}
      {form && (
        <form onSubmit={save} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2">
          <Input autoFocus placeholder="Nombre (ej.: Sede Norte)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Dirección (opcional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="sede-ubicacion" className="text-sm font-medium">
              Ubicación del local <span className="font-normal text-muted">(para el aviso de cercanía)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="sede-ubicacion"
                className="min-w-0 flex-1"
                placeholder="Coordenadas o enlace de Google Maps"
                value={form.place}
                onChange={(e) => setForm({ ...form, place: e.target.value })}
              />
              <Button type="button" variant="secondary" size="sm" onClick={useHere} disabled={locating}>
                {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />} Estoy en el local
              </Button>
            </div>
            <p className="text-xs text-muted">
              {parsed ? (
                <>
                  Ubicación reconocida: {parsed.latitude}, {parsed.longitude} ·{" "}
                  <a className="underline" href={mapUrl(parsed.latitude, parsed.longitude)} target="_blank" rel="noreferrer">
                    ver en el mapa
                  </a>
                </>
              ) : form.place.trim() ? (
                "No la reconocemos. En Google Maps, mantén presionado el local y copia los números que aparecen (ej.: 4.6987, -74.0412)."
              ) : (
                "Con la ubicación, el celular del cliente muestra la tarjeta (iPhone) o un aviso (Android) cuando está cerca. Déjala vacía para no avisar."
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:col-span-2 sm:justify-end">
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
                <p className="text-xs text-muted">
                  {l.latitude != null && l.longitude != null ? (
                    <>
                      Aviso de cercanía {l.active ? "activo" : "en pausa (sede inactiva)"} ·{" "}
                      <a className="underline" href={mapUrl(l.latitude, l.longitude)} target="_blank" rel="noreferrer">
                        ver en el mapa
                      </a>
                    </>
                  ) : (
                    "Sin ubicación: no avisa por cercanía"
                  )}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ id: l.id, name: l.name, address: l.address ?? "", place: coordsText(l) })}>
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
