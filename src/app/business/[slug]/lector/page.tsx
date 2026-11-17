"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MapPin, Nfc, PartyPopper } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import { findCardForReaderAction, prepareSmartTapAction } from "@/lib/data/nfc-actions";
import { Card, PageHeader, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { parseToken } from "@/lib/wallet/smart-tap";
import { greetingName } from "@/lib/wallet/messages";

type Estado =
  | { kind: "listo" }
  | { kind: "guardando" }
  | { kind: "ok"; nombre: string; sellos: number; requeridos: number; premio: boolean }
  | { kind: "error"; mensaje: string };

/**
 * Pantalla del computador de la caja con el lector NFC (VTAP100 en modo teclado).
 * El cliente acerca el celular con la tarjeta en Google Wallet y la visita se registra sola.
 */
export default function LectorPage() {
  const { business, program, cards, customers, membership, locations } = useScope();
  const { registerVisit } = useData();
  const activeLocations = locations.filter((l) => l.active);
  const [locationId, setLocationId] = useState("");
  const [estado, setEstado] = useState<Estado>({ kind: "listo" });
  const [smartTap, setSmartTap] = useState<boolean | null>(null);
  const buffer = useRef("");
  const ocupado = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const puede = !!membership && can(membership, "visits.create");

  // Misma sede recordada que la caja: cada computador suele estar en una sede.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`scan-location:${business.id}`);
      if (saved && activeLocations.some((l) => l.id === saved)) setLocationId(saved);
      else if (activeLocations.length === 1) setLocationId(activeLocations[0].id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, activeLocations.length]);

  useEffect(() => {
    prepareSmartTapAction(business.id).then((r) => setSmartTap(r.enabled), () => setSmartTap(false));
  }, [business.id]);

  // Vuelve al estado de espera unos segundos después de cada lectura.
  useEffect(() => {
    if (estado.kind !== "ok" && estado.kind !== "error") return;
    const t = setTimeout(() => setEstado({ kind: "listo" }), 5000);
    return () => clearTimeout(t);
  }, [estado]);

  const leer = async (texto: string) => {
    if (ocupado.current) return;
    const token = parseToken(texto);
    if (!token) return setEstado({ kind: "error", mensaje: "No se reconoció la tarjeta. Pide al cliente que la acerque de nuevo." });
    ocupado.current = true;
    setEstado({ kind: "guardando" });
    try {
      // Las tarjetas de hoy pueden no estar aún en pantalla: se buscan en el servidor.
      const local = cards.find((c) => c.publicToken === token);
      const card = local
        ? { id: local.id, status: local.status, stamps: local.currentStamps, firstName: (() => { const c = customers.find((x) => x.id === local.customerId); return c ? greetingName(c) : "Cliente"; })() }
        : await findCardForReaderAction(business.id, token);
      if (!card) return setEstado({ kind: "error", mensaje: "Esta tarjeta no es de este negocio." });
      if (card.status === "blocked") return setEstado({ kind: "error", mensaje: "Esta tarjeta está bloqueada." });
      const res = await registerVisit(card.id, crypto.randomUUID(), locationId || undefined);
      if (!res.ok) return setEstado({ kind: "error", mensaje: res.message });
      const requeridos = program?.stampsRequired ?? 0;
      setEstado({
        kind: "ok",
        nombre: card.firstName,
        sellos: Math.min(card.stamps + 1 + (res.data?.bonusStamps ?? 0), requeridos),
        requeridos,
        premio: !!res.data?.reward,
      });
    } catch {
      setEstado({ kind: "error", mensaje: "No hay conexión. Intenta de nuevo." });
    } finally {
      ocupado.current = false;
    }
  };

  if (!program) return null;
  if (!puede) return <PageHeader title="Lector NFC" description="Tu usuario no puede registrar visitas." />;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Lector NFC" description="Deja esta pantalla abierta en el computador de la caja, con el lector conectado." />

      {activeLocations.length > 1 && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted" />
          <span className="text-muted">Sede:</span>
          <Select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              try {
                localStorage.setItem(`scan-location:${business.id}`, e.target.value);
              } catch {}
            }}
          >
            <option value="">Elige la sede donde estás</option>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      {/* El lector escribe como un teclado: el campo recupera el foco para no perder lecturas. */}
      <input
        ref={inputRef}
        autoFocus
        aria-label="Lectura del lector NFC"
        className="sr-only"
        onBlur={() => setTimeout(() => inputRef.current?.focus(), 50)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const texto = buffer.current;
          buffer.current = "";
          e.currentTarget.value = "";
          if (texto.trim()) void leer(texto);
        }}
        onChange={(e) => (buffer.current = e.target.value)}
      />

      <Card
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center transition-colors",
          estado.kind === "ok" && "border-success/30 bg-success-bg text-success",
          estado.kind === "error" && "border-danger/30 bg-danger-bg text-danger",
        )}
      >
        {estado.kind === "listo" && (
          <>
            <Nfc className="size-16 text-brand" strokeWidth={1.5} />
            <p className="text-xl font-semibold">Listo para leer</p>
            <p className="text-sm text-muted">Pide al cliente que acerque el celular al lector.</p>
          </>
        )}
        {estado.kind === "guardando" && (
          <>
            <Loader2 className="size-14 animate-spin text-muted" />
            <p className="text-xl font-semibold">Registrando visita…</p>
          </>
        )}
        {estado.kind === "ok" && (
          <>
            {estado.premio ? <PartyPopper className="size-16" /> : <CheckCircle2 className="size-16" />}
            <p className="text-2xl font-semibold">{estado.premio ? `¡${estado.nombre} ganó su premio!` : `¡Listo, ${estado.nombre}!`}</p>
            <p className="text-base">{estado.premio ? program.rewardName : `Lleva ${estado.sellos} de ${estado.requeridos} sellos.`}</p>
          </>
        )}
        {estado.kind === "error" && (
          <>
            <AlertCircle className="size-16" />
            <p className="text-xl font-semibold">No se registró la visita</p>
            <p className="text-sm">{estado.mensaje}</p>
          </>
        )}
      </Card>

      {smartTap === false && (
        <p className="mt-4 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-muted">
          El toque con Google Wallet todavía no está encendido en la plataforma. Mientras tanto, esta pantalla registra las tarjetas que lea un lector de códigos QR.
        </p>
      )}
      <p className="mt-4 text-center text-xs text-muted">Cada lectura queda en el historial como una visita y se puede revertir.</p>
    </div>
  );
}
