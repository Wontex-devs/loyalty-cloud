"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Gift, Loader2, MapPin, PartyPopper, ScanBarcode, XCircle } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import { findCardByScanCodeAction, premiosDeTarjetaAction } from "@/lib/data/loyalty-actions";
import { codigoLegible, esCodigoTarjeta, limpiarCodigo } from "@/lib/domain/code128";
import { codigoDeLectura } from "@/lib/domain/enlace-sello";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type Estado =
  | { tipo: "esperando" }
  | { tipo: "guardando" }
  | { tipo: "ok"; nombre: string; sellos: number; requeridos: number; premio: boolean; premios: { id: string; name: string }[] }
  | { tipo: "canjeando"; nombre: string; premio: string }
  | { tipo: "canjeado"; nombre: string; premio: string }
  | { tipo: "error"; mensaje: string };

type Lector = { stop: () => void };

/**
 * El cliente muestra el código QR de su tarjeta (en Apple Wallet, Google Wallet o la tarjeta web)
 * y quien atiende lo escanea con la cámara de su celular. Se suma el sello con las reglas de siempre.
 * Si la cámara no lo lee, se puede escribir el número que aparece debajo del código.
 * También lee el código de barras de las tarjetas guardadas antes del cambio a QR.
 * El QR lleva un enlace (…/sello/número): si se escanea con la cámara normal del celular, ese enlace
 * abre esta página con ?codigo=número y el sello se suma solo, una vez.
 */
export default function EscanearPage() {
  const { business, program, membership, locations } = useScope();
  const { registerVisit, redeemReward } = useData();
  const puede = !!membership && can(membership, "visits.create");
  const puedeCanjear = !!membership && can(membership, "rewards.redeem");
  const sedes = locations.filter((l) => l.active);
  const [sede, setSede] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "esperando" });
  const [camara, setCamara] = useState<"apagada" | "abriendo" | "encendida" | "sin-permiso">("apagada");
  const [numero, setNumero] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const lector = useRef<Lector | null>(null);
  const ocupado = useRef(false);
  const ultimo = useRef<{ codigo: string; en: number; clave: string }>({ codigo: "", en: 0, clave: "" });
  const [sedeLista, setSedeLista] = useState(false);
  const desdeEnlace = useRef(false);

  // Cada celular suele quedarse en la misma sede.
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(`scan-location:${business.id}`);
      if (guardada && sedes.some((l) => l.id === guardada)) setSede(guardada);
      else if (sedes.length === 1) setSede(sedes[0].id);
    } catch {}
    setSedeLista(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, sedes.length]);

  // Después de cada lectura vuelve a quedar listo para el siguiente cliente.
  useEffect(() => {
    if (estado.tipo !== "ok" && estado.tipo !== "error" && estado.tipo !== "canjeado") return;
    if (estado.tipo === "ok" && estado.premios.length > 0) return;
    const t = setTimeout(() => setEstado({ tipo: "esperando" }), 4000);
    return () => clearTimeout(t);
  }, [estado]);

  const sumar = useCallback(
    async (leido: string, manual = false) => {
      // Acepta el enlace del QR nuevo, el número solo del QR anterior y el número escrito a mano.
      const codigo = codigoDeLectura(leido);
      if (ocupado.current) return;
      const repetido = codigo === ultimo.current.codigo && Date.now() - ultimo.current.en < 60_000;
      // La cámara lee el mismo código varias veces por segundo: durante un minuto solo cuenta una vez
      // y se avisa, en vez de ignorarlo en silencio.
      if (repetido && !manual) {
        setEstado((e) => (e.tipo === "esperando" ? { tipo: "error", mensaje: "Esta tarjeta ya se sumó hace un momento." } : e));
        return;
      }
      // La misma clave para el mismo código: si se reintenta, la base reconoce la visita y no suma dos veces.
      const clave = repetido ? ultimo.current.clave : crypto.randomUUID();
      ultimo.current = { codigo, en: Date.now(), clave };
      if (!esCodigoTarjeta(codigo)) return setEstado({ tipo: "error", mensaje: "Ese código no es de una tarjeta de Lazo." });
      ocupado.current = true;
      setEstado({ tipo: "guardando" });
      try {
        const tarjeta = await findCardByScanCodeAction(business.id, codigo);
        if (!tarjeta) return setEstado({ tipo: "error", mensaje: "Esta tarjeta no es de este negocio." });
        if (tarjeta.status === "blocked") return setEstado({ tipo: "error", mensaje: "Esta tarjeta está bloqueada." });
        const res = await registerVisit(tarjeta.id, clave, sede || undefined);
        if (!res.ok) return setEstado({ tipo: "error", mensaje: res.message });
        try {
          navigator.vibrate?.(60);
        } catch {}
        const requeridos = program?.stampsRequired ?? 0;
        const sellos = res.data?.currentStamps ?? Math.min(tarjeta.stamps + 1 + (res.data?.bonusStamps ?? 0), requeridos);
        // Premios por entregar: el que se acaba de ganar y los que tenía de antes.
        const premios = await premiosDeTarjetaAction(tarjeta.id).catch(() => []);
        setEstado({ tipo: "ok", nombre: tarjeta.firstName, sellos: Math.min(sellos, requeridos), requeridos, premio: !!res.data?.reward, premios });
        setNumero("");
      } catch {
        setEstado({ tipo: "error", mensaje: "No hay conexión. Intenta de nuevo." });
      } finally {
        ocupado.current = false;
      }
    },
    [business.id, program?.stampsRequired, registerVisit, sede],
  );

  const canjear = async (nombre: string, premio: { id: string; name: string }) => {
    setEstado({ tipo: "canjeando", nombre, premio: premio.name });
    const r = await redeemReward(premio.id).catch(() => ({ ok: false as const, message: "No hay conexión. Intenta de nuevo." }));
    if (r.ok) {
      try {
        navigator.vibrate?.([40, 60, 40]);
      } catch {}
      setEstado({ tipo: "canjeado", nombre, premio: premio.name });
    } else setEstado({ tipo: "error", mensaje: r.message });
  };

  const apagar = useCallback(() => {
    lector.current?.stop();
    lector.current = null;
    setCamara((c) => (c === "sin-permiso" ? c : "apagada"));
  }, []);

  const encender = async () => {
    if (!video.current) return;
    setCamara("abriendo");
    try {
      // La librería se carga solo cuando se abre la cámara: no pesa en el resto del panel.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const pistas = new Map();
      // QR primero (lo que llevan las tarjetas). CODE_128 queda por las tarjetas guardadas en la billetera
      // antes del cambio: se actualizan solas, pero mientras tanto se siguen leyendo.
      pistas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]);
      const r = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: 80 });
      lector.current = await r.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        video.current,
        (resultado) => {
          if (resultado) void sumar(resultado.getText());
        },
      );
      setCamara("encendida");
    } catch {
      lector.current = null;
      setCamara("sin-permiso");
    }
  };

  useEffect(() => apagar, [apagar]);

  // Llegó desde el enlace del QR (cámara normal del celular): suma el sello una sola vez y limpia la dirección,
  // para que recargar la página no lo vuelva a sumar. Espera a saber la sede guardada en este celular.
  useEffect(() => {
    if (desdeEnlace.current || !sedeLista || !puede || !program) return;
    const codigo = new URLSearchParams(window.location.search).get("codigo");
    if (!codigo) return;
    desdeEnlace.current = true;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    void sumar(codigo, true);
  }, [sedeLista, puede, program, sumar]);

  if (!program) return null;
  if (!puede) return <PageHeader title="Escanear tarjeta" description="Tu usuario no puede registrar visitas." />;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Escanear tarjeta" description="Pide al cliente que muestre el código QR de su tarjeta y apunta la cámara." />

      {sedes.length > 1 && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted" />
          <span className="text-muted">Sede:</span>
          <Select
            value={sede}
            onChange={(e) => {
              setSede(e.target.value);
              try {
                localStorage.setItem(`scan-location:${business.id}`, e.target.value);
              } catch {}
            }}
          >
            <option value="">Elige la sede donde estás</option>
            {sedes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <Card className="overflow-hidden">
        <div className="relative aspect-[4/3] w-full bg-[#0b0b0b]">
          <video ref={video} muted playsInline className={cn("size-full object-cover", camara !== "encendida" && "invisible")} />
          {camara === "encendida" && (
            <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 aspect-square h-[62%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
          )}
          {camara !== "encendida" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {camara === "sin-permiso" ? <CameraOff className="size-10 opacity-80" /> : <ScanBarcode className="size-10 opacity-80" />}
              <p className="max-w-xs text-sm opacity-85">
                {camara === "sin-permiso"
                  ? "No pudimos abrir la cámara. Permite el acceso a la cámara para este sitio en los ajustes del navegador, o escribe el número abajo."
                  : "Abre la cámara y apunta al código QR de la tarjeta del cliente."}
              </p>
              <Button onClick={() => void encender()} disabled={camara === "abriendo"}>
                {camara === "abriendo" ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} {camara === "sin-permiso" ? "Intentar de nuevo" : "Abrir cámara"}
              </Button>
            </div>
          )}

          {/* El resultado aparece encima de la cámara, en grande, para leerlo de un vistazo. */}
          {estado.tipo !== "esperando" && (
            <div
              role="status"
              className={cn(
                "absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl p-4 text-left shadow-lg",
                (estado.tipo === "ok" || estado.tipo === "canjeado") && "bg-success-bg text-success",
                estado.tipo === "error" && "bg-danger-bg text-danger",
                (estado.tipo === "guardando" || estado.tipo === "canjeando") && "bg-surface text-ink",
              )}
            >
              {(estado.tipo === "guardando" || estado.tipo === "canjeando") && <Loader2 className="size-7 shrink-0 animate-spin" />}
              {estado.tipo === "canjeado" && <Gift className="size-7 shrink-0" />}
              {estado.tipo === "ok" && (estado.premio ? <PartyPopper className="size-7 shrink-0" /> : <CheckCircle2 className="size-7 shrink-0" />)}
              {estado.tipo === "error" && <XCircle className="size-7 shrink-0" />}
              <div className="min-w-0 flex-1">
                {estado.tipo === "guardando" && <p className="font-semibold">Sumando el sello…</p>}
                {estado.tipo === "canjeando" && <p className="font-semibold">Canjeando {estado.premio}…</p>}
                {estado.tipo === "canjeado" && (
                  <>
                    <p className="text-lg font-semibold">Premio entregado</p>
                    <p className="text-sm">
                      {estado.premio} para {estado.nombre}.
                    </p>
                  </>
                )}
                {estado.tipo === "ok" && (
                  <>
                    <p className="text-lg font-semibold">¡Sello registrado, {estado.nombre}!</p>
                    <p className="text-sm">
                      {estado.premio ? "¡Completó su tarjeta!" : `Lleva ${estado.sellos} de ${estado.requeridos}.`}
                    </p>
                    {estado.premios.length > 0 && (
                      <div className="mt-3 rounded-lg bg-surface p-3 text-ink">
                        <p className="text-sm font-medium">
                          {estado.premios.length === 1 ? "Tiene un premio listo:" : `Tiene ${estado.premios.length} premios listos. El primero:`} {estado.premios[0].name}
                        </p>
                        {puedeCanjear ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="lg" onClick={() => void canjear(estado.nombre, estado.premios[0])}>
                              <Gift className="size-4" /> Canjear ahora
                            </Button>
                            <Button size="lg" variant="ghost" onClick={() => setEstado({ tipo: "esperando" })}>
                              Ahora no
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="mt-1 text-xs text-muted">Tu usuario no puede canjear premios: pídeselo a quien tenga ese permiso.</p>
                            <Button size="lg" variant="ghost" className="mt-2" onClick={() => setEstado({ tipo: "esperando" })}>
                              Listo
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                {estado.tipo === "error" && <p className="font-semibold">{estado.mensaje}</p>}
              </div>
            </div>
          )}
        </div>

        {camara === "encendida" && (
          <div className="flex justify-end border-t border-line p-3">
            <Button variant="ghost" size="sm" onClick={apagar}>
              <CameraOff className="size-4" /> Cerrar cámara
            </Button>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void sumar(numero, true);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-ink">¿La cámara no lo lee? Escribe el número</span>
            <Input
              className="mt-1.5 font-mono tracking-[0.12em]"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000 0000 0000"
              value={numero}
              onChange={(e) => setNumero(codigoLegible(limpiarCodigo(e.target.value).slice(0, 12)))}
            />
          </label>
          <Button type="submit" size="lg" disabled={!esCodigoTarjeta(limpiarCodigo(numero)) || estado.tipo === "guardando" || estado.tipo === "canjeando"}>
            Sumar sello
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">Es el número que aparece debajo del código QR, en la tarjeta del cliente.</p>
      </Card>
    </div>
  );
}
