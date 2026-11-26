"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, PartyPopper, Search, Truck } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { SelloSinQr } from "@/components/business/sello-sin-qr";
import { Button, Card, Input } from "@/components/ui";
import { coincideCliente } from "@/lib/domain/sello-sin-qr";
import { cn } from "@/lib/utils";

/**
 * En la página de escanear: sumar un sello sin leer el QR (pedido a domicilio o código que no
 * se puede escanear). Se busca al cliente por nombre o celular y se escribe el motivo.
 */
export function BuscarSelloSinQr({ sede }: { sede: string }) {
  const { customers, cards, locations, program } = useScope();
  const sedes = locations.filter((l) => l.active);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ nombre: string; premio: boolean; sellos?: number } | null>(null);

  const tarjetaDe = useMemo(() => new Map(cards.map((c) => [c.customerId, c])), [cards]);
  const resultados = useMemo(
    () =>
      busqueda.trim().length < 2
        ? []
        : customers.filter((c) => !c.anonymizedAt && tarjetaDe.has(c.id) && coincideCliente(busqueda, c.fullName, c.phone)).slice(0, 6),
    [busqueda, customers, tarjetaDe],
  );
  const cliente = elegido ? customers.find((c) => c.id === elegido) : undefined;
  const tarjeta = cliente ? tarjetaDe.get(cliente.id) : undefined;

  const cerrar = () => {
    setAbierto(false);
    setBusqueda("");
    setElegido(null);
  };

  return (
    <Card className="mt-4 p-5">
      {hecho && (
        <div role="status" className="mb-3 flex items-center gap-3 rounded-lg border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
          {hecho.premio ? <PartyPopper className="size-5 shrink-0" /> : <CheckCircle2 className="size-5 shrink-0" />}
          <p>
            <span className="font-semibold">Sello sumado sin QR a {hecho.nombre}.</span>{" "}
            {hecho.premio ? "¡Completó su tarjeta!" : hecho.sellos !== undefined && program ? `Lleva ${hecho.sellos} de ${program.stampsRequired}.` : ""}
          </p>
        </div>
      )}

      {!abierto ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">¿Pedido a domicilio o el QR no se puede leer?</p>
            <p className="text-xs text-muted">Busca al cliente y suma el sello sin escanear. Tendrás que escribir el motivo.</p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setAbierto(true);
              setHecho(null);
            }}
          >
            <Truck className="size-4" /> Sumar sello sin QR
          </Button>
        </div>
      ) : tarjeta && cliente ? (
        tarjeta.status === "blocked" ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">La tarjeta de {cliente.fullName} está bloqueada.</p>
            <Button variant="ghost" onClick={() => setElegido(null)}>
              Elegir otro cliente
            </Button>
          </div>
        ) : (
          <SelloSinQr
            cardId={tarjeta.id}
            nombre={cliente.fullName}
            sedes={sedes}
            sede={sede}
            onCancelar={() => setElegido(null)}
            onListo={(res) => {
              setHecho({ nombre: cliente.fullName.split(" ")[0], premio: !!res.data?.reward, sellos: res.data?.currentStamps });
              cerrar();
            }}
          />
        )
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[13px] font-medium text-ink">Busca al cliente por nombre o celular</span>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" autoFocus autoComplete="off" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: María o 300 123" />
            </div>
          </label>
          {busqueda.trim().length >= 2 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {resultados.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-muted">No hay clientes con ese nombre o celular.</li>
              ) : (
                resultados.map((c) => {
                  const t = tarjetaDe.get(c.id)!;
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setElegido(c.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.fullName}</span>
                          <span className="block text-xs text-muted">{c.phone}</span>
                        </span>
                        <span className={cn("shrink-0 text-xs", t.status === "blocked" ? "text-danger" : "text-muted")}>
                          {t.status === "blocked" ? "Bloqueada" : program ? `${t.currentStamps} de ${program.stampsRequired}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  );
}
