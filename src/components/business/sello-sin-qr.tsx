"use client";

import { useState } from "react";
import { Loader2, Stamp } from "lucide-react";
import { Button, Card, Input, Select } from "@/components/ui";
import { useData, type OpResult } from "@/lib/data/store";
import { esDomicilio, MOTIVO_MIN, MOTIVOS_SIN_QR, motivoSinQr } from "@/lib/domain/sello-sin-qr";
import type { Location } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Sumar un sello sin leer el QR (pedido a domicilio, código que no se puede escanear…).
 * El motivo es obligatorio; si es un domicilio, se puede añadir el número de factura o pedido.
 * Se aplican las reglas de siempre y queda registrado con el nombre de quien lo sumó y el motivo.
 */
export function SelloSinQr({
  cardId,
  nombre,
  sedes,
  sede: sedeInicial = "",
  onListo,
  onCancelar,
}: {
  cardId: string;
  /** Nombre del cliente, para confirmar a quién se le suma. */
  nombre: string;
  /** Sedes activas del comercio. */
  sedes: Location[];
  sede?: string;
  onListo: (res: Extract<OpResult, { ok: true }>) => void;
  onCancelar: () => void;
}) {
  const { registerManualVisit } = useData();
  const [motivo, setMotivo] = useState("");
  const [factura, setFactura] = useState("");
  const [sede, setSede] = useState(sedeInicial || (sedes.length === 1 ? sedes[0].id : ""));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domicilio = esDomicilio(motivo);
  const listo = motivo.trim().length >= MOTIVO_MIN && (sedes.length <= 1 || !!sede);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = motivoSinQr(motivo, domicilio ? factura : "");
    if (!m.ok) return setError(m.error);
    if (sedes.length > 1 && !sede) return setError("Elige la sede.");
    setOcupado(true);
    setError(null);
    const res = await registerManualVisit(cardId, crypto.randomUUID(), m.texto, sede || undefined);
    setOcupado(false);
    if (!res.ok) return setError(res.message);
    onListo(res);
  };

  return (
    <Card className="space-y-3 p-4">
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Sumar sello sin QR a {nombre}</p>
          <p className="text-xs text-muted">
            Para pedidos a domicilio o cuando el código no se puede leer. Se aplican las reglas de siempre y queda registrado con tu nombre y el motivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS_SIN_QR.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className={cn("rounded-full border px-2.5 py-1 text-xs", motivo === m ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-line-strong")}
            >
              {m}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-[13px] font-medium">Motivo (obligatorio)</span>
          <Input className="mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={145} placeholder="¿Por qué se suma sin leer el QR?" required />
        </label>
        {domicilio && (
          <label className="block">
            <span className="text-[13px] font-medium">Número de factura o pedido</span>
            <Input className="mt-1" value={factura} onChange={(e) => setFactura(e.target.value)} maxLength={40} placeholder="Ej.: FV-1234" autoComplete="off" />
          </label>
        )}
        {sedes.length > 1 && (
          <Select value={sede} onChange={(e) => setSede(e.target.value)} aria-label="Sede">
            <option value="">Elige la sede</option>
            {sedes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        {error && <p className="rounded-lg border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="brand" disabled={!listo || ocupado}>
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />} Sumar 1 sello
          </Button>
          <Button type="button" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
