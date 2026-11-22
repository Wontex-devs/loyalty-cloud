"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Wallet } from "lucide-react";
import {
  cambiarPagadoHastaAction,
  cargarCobrosAction,
  pagosDelComercioAction,
  registrarPagoAction,
  type PagoComercio,
} from "@/lib/data/cobros-actions";
import { ESTADOS_COBRO, estadoCobro, fechaCorta, hoyColombia, sumarMeses, textoVencimiento } from "@/lib/domain/cobros";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import { formatMoney } from "@/lib/utils";
import { Aviso, Modal, usePuedeEditar } from "./piezas";

/** Fechas «pagado hasta» de todos los comercios (solo el equipo de la plataforma las ve). */
export function useCobros() {
  const [fechas, setFechas] = useState<Record<string, string>>({});
  const [mesGratis, setMesGratis] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const recargar = useCallback(async () => {
    const r = await cargarCobrosAction().catch(() => ({ fechas: {}, mesGratis: {}, aviso: "No se pudieron cargar las fechas de pago." }));
    setFechas(r.fechas);
    setMesGratis(r.mesGratis);
    setAviso(r.aviso);
    setCargando(false);
  }, []);
  useEffect(() => {
    void recargar();
  }, [recargar]);
  return { fechas, mesGratis, aviso, cargando, recargar };
}

export function EtiquetaCobro({ pagadoHasta }: { pagadoHasta?: string }) {
  const e = ESTADOS_COBRO[estadoCobro(pagadoHasta)];
  return (
    <div>
      <Badge tone={e.tono} dot>
        {e.nombre}
      </Badge>
      {pagadoHasta && <p className="mt-0.5 text-xs text-muted">{textoVencimiento(pagadoHasta)}</p>}
    </div>
  );
}

/** Tarjeta de cobros en el detalle de un comercio: estado, registrar pago, corregir fecha e historial. */
export function TarjetaCobros({ businessId, nombre, precioPlan, planId }: { businessId: string; nombre: string; precioPlan: number; planId: string }) {
  const puedeEditar = usePuedeEditar();
  const { fechas, mesGratis, aviso, cargando, recargar } = useCobros();
  // Oferta Starter: el primer pago de un comercio nuevo trae el segundo mes gratis.
  const conMesGratis = !!mesGratis[businessId] && planId === "plan_starter";
  const [pagos, setPagos] = useState<PagoComercio[]>([]);
  const [modal, setModal] = useState<"pago" | "fecha" | null>(null);
  const cerrar = useCallback(() => setModal(null), []);
  const pagadoHasta = fechas[businessId];

  const cargarPagos = useCallback(async () => setPagos(await pagosDelComercioAction(businessId).catch(() => [])), [businessId]);
  useEffect(() => {
    void cargarPagos();
  }, [cargarPagos]);

  const alGuardar = async () => {
    setModal(null);
    await Promise.all([recargar(), cargarPagos()]);
  };

  return (
    <Card className="mt-4">
      <CardHeader
        title="Cobros"
        description="Solo lo ve el equipo de Lazo. Nada se suspende solo: si no paga, decides tú."
        action={
          puedeEditar && !aviso ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setModal("fecha")}>
                <CalendarClock className="size-4" /> Cambiar fecha
              </Button>
              <Button size="sm" onClick={() => setModal("pago")}>
                <Wallet className="size-4" /> Registrar pago
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="p-5">
        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Cargando…
          </p>
        ) : aviso ? (
          <p className="text-sm text-warning">{aviso}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="text-[13px] text-muted">Pagado hasta</p>
              <p className="text-lg font-semibold">{fechaCorta(pagadoHasta)}</p>
            </div>
            <EtiquetaCobro pagadoHasta={pagadoHasta} />
            {conMesGratis && (
              <Badge tone="brand">Primer pago: el segundo mes es gratis</Badge>
            )}
          </div>
        )}
      </div>
      {pagos.length > 0 && (
        <div className="border-t border-line">
          <p className="px-5 pt-4 text-[13px] font-medium text-ink">Pagos registrados</p>
          <ul className="divide-y divide-line">
            {pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="font-medium tabular">{formatMoney(p.amount)}</span>
                <span className="text-muted">
                  Pagó el {fechaCorta(p.paidOn)} · {p.months} {p.months === 1 ? "mes" : "meses"}
                  {p.freeMonths > 0 && ` + ${p.freeMonths} ${p.freeMonths === 1 ? "mes gratis" : "meses gratis"}`} · hasta {fechaCorta(p.paidUntil)}
                </span>
                {p.note && <span className="w-full text-xs text-muted">{p.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal abierto={modal === "pago"} onCerrar={cerrar} titulo={`Registrar pago de ${nombre}`} descripcion="La fecha «pagado hasta» avanza los meses pagados, desde la fecha actual de vencimiento.">
        {modal === "pago" && (
          <FormularioPago businessId={businessId} pagadoHasta={pagadoHasta} precioPlan={precioPlan} conMesGratis={conMesGratis} onListo={alGuardar} onCancelar={cerrar} />
        )}
      </Modal>
      <Modal abierto={modal === "fecha"} onCerrar={cerrar} titulo={`Cambiar fecha de ${nombre}`} descripcion="Para corregir un error o dar días extra. Queda en la auditoría con el motivo.">
        {modal === "fecha" && <FormularioFecha businessId={businessId} pagadoHasta={pagadoHasta} onListo={alGuardar} onCancelar={cerrar} />}
      </Modal>
    </Card>
  );
}

function FormularioPago({
  businessId,
  pagadoHasta,
  precioPlan,
  conMesGratis,
  onListo,
  onCancelar,
}: {
  businessId: string;
  pagadoHasta?: string;
  precioPlan: number;
  conMesGratis: boolean;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [meses, setMeses] = useState(1);
  const [monto, setMonto] = useState(precioPlan);
  const [fecha, setFecha] = useState(hoyColombia());
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  // Igual que la base de datos: con el mes gratis, cuenta desde el día en que pagó si es posterior.
  const desde = pagadoHasta ?? hoyColombia();
  const nuevaFecha = conMesGratis ? sumarMeses(fecha > desde ? fecha : desde, meses + 1) : sumarMeses(desde, meses);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        setAviso(null);
        const r = await registrarPagoAction({ businessId, monto, fecha, meses, nota: nota || undefined }).catch(() => ({ ok: false as const, message: "No hay conexión. Intenta de nuevo." }));
        setGuardando(false);
        if (r.ok) onListo();
        else setAviso({ ok: false, texto: r.message });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meses que paga">
          <NumberInput
            value={meses}
            min={1}
            max={12}
            onValueChange={(n) => {
              setMeses(n);
              setMonto(precioPlan * n);
            }}
          />
        </Field>
        <Field label="Monto (COP)">
          <NumberInput value={monto} min={0} max={99_999_999} onValueChange={setMonto} />
        </Field>
        <Field label="Fecha del pago">
          <Input type="date" value={fecha} max={hoyColombia()} onChange={(e) => setFecha(e.target.value)} required />
        </Field>
        <Field label="Nota (opcional)" hint="Ej.: transferencia Bancolombia">
          <Input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} />
        </Field>
      </div>
      <p className="rounded-lg bg-canvas px-3 py-2 text-[13px]">
        {conMesGratis && <>Es su primer pago del plan Starter: se suma <strong>1 mes gratis</strong>. </>}
        Quedará pagado hasta el <strong>{fechaCorta(nuevaFecha)}</strong>.
      </p>
      <Aviso aviso={aviso} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 className="size-4 animate-spin" />} Registrar pago
        </Button>
      </div>
    </form>
  );
}

function FormularioFecha({ businessId, pagadoHasta, onListo, onCancelar }: { businessId: string; pagadoHasta?: string; onListo: () => void; onCancelar: () => void }) {
  const [fecha, setFecha] = useState(pagadoHasta ?? hoyColombia());
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        setAviso(null);
        const r = await cambiarPagadoHastaAction({ businessId, fecha, motivo }).catch(() => ({ ok: false as const, message: "No hay conexión. Intenta de nuevo." }));
        setGuardando(false);
        if (r.ok) onListo();
        else setAviso({ ok: false, texto: r.message });
      }}
    >
      <Field label="Pagado hasta">
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </Field>
      <Field label="Motivo" hint="Ej.: empezó a pagar el 1 de diciembre">
        <Input value={motivo} minLength={3} maxLength={200} onChange={(e) => setMotivo(e.target.value)} required />
      </Field>
      <Aviso aviso={aviso} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando || motivo.trim().length < 3}>
          {guardando && <Loader2 className="size-4 animate-spin" />} Guardar fecha
        </Button>
      </div>
    </form>
  );
}
