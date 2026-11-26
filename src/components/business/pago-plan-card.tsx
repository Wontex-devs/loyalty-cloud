"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Gift, Loader2, XCircle } from "lucide-react";
import { Badge, Button, Card, CardHeader, Select } from "@/components/ui";
import { confirmarRegresoAction, estadoPagoAction, iniciarPagoAction, type EstadoPago } from "@/lib/data/pagos-actions";
import { ESTADOS_COBRO, estadoCobro, fechaCorta, hoyColombia, sumarMeses, textoVencimiento } from "@/lib/domain/cobros";
import { formatMoney } from "@/lib/utils";

const MESES = [1, 3, 6, 12];

/**
 * «Pago del plan» (Más opciones → Pago del plan): hasta cuándo está pagado y el botón para pagar
 * en línea (Mercado Pago o Wompi). Al volver muestra si el pago quedó aprobado: la confirmación
 * llega al servidor consultando a la pasarela, así que puede tardar unos segundos.
 */
export function PagoPlanCard({ businessId }: { businessId: string }) {
  const [estado, setEstado] = useState<EstadoPago | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meses, setMeses] = useState(1);
  const [yendo, setYendo] = useState(false);
  const [regreso, setRegreso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await estadoPagoAction(businessId).catch(() => ({ ok: false as const, message: "No hay conexión." }));
    if (r.ok) setEstado(r.estado);
    else setError(r.message);
    return r.ok ? r.estado : null;
  }, [businessId]);

  useEffect(() => {
    void cargar();
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("pago");
    if (ref?.startsWith("lazo-")) {
      setRegreso(ref);
      // Mercado Pago agrega payment_id al volver: se confirma de una vez (consultando su API).
      const pid = q.get("payment_id") ?? q.get("collection_id");
      if (pid && pid !== "null") void confirmarRegresoAction(pid).then(() => cargar());
    }
  }, [cargar]);

  // Al volver de Wompi: se consulta cada 3 s, hasta 90 s, hasta que la orden tenga su estado final.
  useEffect(() => {
    if (!regreso) return;
    let vueltas = 0;
    const t = setInterval(async () => {
      vueltas++;
      const e = await cargar();
      const o = e?.ordenes.find((x) => x.referencia === regreso);
      if ((o && o.estado !== "PENDING") || vueltas >= 30) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [regreso, cargar]);

  if (error && !estado) return null; // empleados: no ven el cobro
  if (!estado)
    return (
      <Card className="flex items-center gap-2 p-5 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" /> Cargando tu plan…
      </Card>
    );

  const conMesGratis = estado.mesGratisPendiente && estado.planId === "plan_starter";
  const hoy = hoyColombia();
  const desde = estado.pagadoHasta ?? hoy;
  const hasta = conMesGratis ? sumarMeses(desde > hoy ? desde : hoy, meses + 1) : sumarMeses(desde, meses);
  const e = ESTADOS_COBRO[estadoCobro(estado.pagadoHasta)];
  const orden = regreso ? estado.ordenes.find((o) => o.referencia === regreso) : undefined;

  const pagar = async () => {
    setYendo(true);
    setError(null);
    const r = await iniciarPagoAction(businessId, meses).catch(() => ({ ok: false as const, message: "No hay conexión. Intenta de nuevo." }));
    if (r.ok) window.location.href = r.url;
    else {
      setYendo(false);
      setError(r.message);
    }
  };

  return (
    <Card id="plan" className="scroll-mt-6">
      <CardHeader title={`Plan ${estado.planNombre}`} description={`${formatMoney(estado.precioMensual)} al mes, con IVA incluido`} />
      <div className="space-y-4 p-5 text-sm">
        {regreso && (
          <div className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2.5">
            {!orden || orden.estado === "PENDING" ? (
              <>
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> Estamos confirmando tu pago…
              </>
            ) : orden.estado === "APPROVED" ? (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> ¡Pago aprobado! Tu plan quedó pagado hasta el {fechaCorta(estado.pagadoHasta)}.
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-4 shrink-0 text-danger" /> El pago no se aprobó. Puedes intentarlo de nuevo.
              </>
            )}
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted">Pagado hasta</p>
            <p className="text-lg font-semibold">{fechaCorta(estado.pagadoHasta)}</p>
            <p className="text-xs text-muted">{textoVencimiento(estado.pagadoHasta)}</p>
          </div>
          <Badge tone={e.tono} dot>
            {e.nombre}
          </Badge>
        </div>

        {estado.disponible ? (
          <>
            {conMesGratis && (
              <p className="flex items-start gap-2 rounded-lg bg-sun/25 px-3 py-2 text-coal">
                <Gift className="mt-0.5 size-4 shrink-0" /> Tu primer pago incluye el <strong className="font-semibold">segundo mes gratis</strong>.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Select value={String(meses)} onChange={(ev) => setMeses(Number(ev.target.value))} className="w-36" aria-label="Meses a pagar">
                {MESES.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? "mes" : "meses"}
                  </option>
                ))}
              </Select>
              <p className="font-semibold">{formatMoney(estado.precioMensual * meses)}</p>
            </div>
            <p className="text-xs text-muted">
              Quedará pagado hasta el <strong className="font-medium text-ink-2">{fechaCorta(hasta)}</strong>
              {conMesGratis && " (con el mes gratis)"}.
            </p>
            <Button onClick={pagar} disabled={yendo} className="w-full">
              {yendo ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} {estado.pasarela === "mercadopago" ? "Pagar con Mercado Pago" : "Pagar con Wompi"}
            </Button>
            <p className="text-xs text-muted">
              {estado.pasarela === "mercadopago"
                ? "PSE, tarjeta débito o crédito y Efecty. El pago se hace en la página segura de Mercado Pago."
                : "PSE, Nequi, Bancolombia o tarjeta. El pago se hace en la página segura de Wompi."}
            </p>
            {estado.pruebas && <p className="text-xs text-warning">Modo de pruebas: los pagos no se cobran de verdad.</p>}
          </>
        ) : (
          <p className="text-muted">Pronto podrás pagar aquí en línea. Mientras tanto, escríbenos por WhatsApp para pagar tu plan.</p>
        )}
        {error && <p className="text-danger">{error}</p>}
      </div>
    </Card>
  );
}
