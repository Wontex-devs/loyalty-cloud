"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Nfc, RefreshCw } from "lucide-react";
import { getNfcSettingsAction, setNfcSettingsAction, type NfcSettings } from "@/lib/data/nfc-actions";
import { Button, Card, CardHeader, Field, Select, Switch } from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data/store";

const ESPERAS = [
  { value: 0, label: "Solo el tiempo del programa" },
  { value: 60, label: "1 hora entre toques" },
  { value: 120, label: "2 horas entre toques (recomendado)" },
  { value: 240, label: "4 horas entre toques" },
  { value: 480, label: "8 horas entre toques" },
  { value: 1440, label: "1 vez al día" },
];

/** Lector y escritor de etiquetas NFC del navegador (Chrome en Android). No está en los tipos de TypeScript. */
type NdefEscritor = { write: (mensaje: { records: { recordType: string; data: string }[] }) => Promise<void> };
const escritorNfc = () => {
  const ctor = (window as unknown as { NDEFReader?: new () => NdefEscritor }).NDEFReader;
  return ctor ? new ctor() : null;
};

/**
 * Tarjeta NFC del mostrador: el comercio enciende o apaga el toque. El enlace secreto y el grabado de la
 * etiqueta solo los ve el equipo de Lazo, que entrega la tarjeta en persona.
 */
export function NfcCard({ businessId, slug }: { businessId: string; slug: string }) {
  const [ajustes, setAjustes] = useState<NfcSettings | null>(null);
  const [espera, setEspera] = useState(120);
  const [porDia, setPorDia] = useState(1);
  // Los interruptores también son borrador: nada cambia hasta pulsar «Guardar ajustes».
  const [encendido, setEncendido] = useState(false);
  const [exigir, setExigir] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [origen, setOrigen] = useState("");
  // Solo el superadministrador dentro del comercio ve el enlace secreto y graba etiquetas.
  const equipoLazo = useData().state.supportView?.modo === "edit";

  useEffect(() => setOrigen(window.location.origin), []);

  const mostrar = (s: NfcSettings) => {
    setEspera(s.minMinutes);
    setPorDia(s.maxPerDay);
    setEncendido(s.enabled);
    setExigir(s.requireLocation);
  };

  useEffect(() => {
    let vivo = true;
    void getNfcSettingsAction(businessId).then((r) => {
      if (!vivo) return;
      setCargando(false);
      if (r.ok) {
        setAjustes(r.settings);
        mostrar(r.settings);
      } else setAviso({ ok: false, texto: r.message });
    });
    return () => {
      vivo = false;
    };
  }, [businessId]);

  const hayCambios =
    !!ajustes && (encendido !== ajustes.enabled || exigir !== ajustes.requireLocation || espera !== ajustes.minMinutes || porDia !== ajustes.maxPerDay);

  /** Guarda el borrador. Al cambiar el secreto (`rotar`) se conservan los ajustes ya guardados, no el borrador. */
  const guardar = async (rotar = false) => {
    if (!ajustes) return;
    setGuardando(true);
    setAviso(null);
    const r = rotar
      ? await setNfcSettingsAction(businessId, ajustes.enabled, ajustes.minMinutes, true, { maxPerDay: ajustes.maxPerDay })
      : await setNfcSettingsAction(businessId, encendido, espera, false, { maxPerDay: porDia, requireLocation: exigir });
    setGuardando(false);
    if (r.ok) {
      setAjustes(r.settings);
      if (!rotar) mostrar(r.settings);
      setAviso({ ok: true, texto: rotar ? "Listo: las etiquetas viejas dejaron de funcionar. Escribe la nueva." : "Ajustes guardados." });
    } else setAviso({ ok: false, texto: r.message });
  };

  const enlace = ajustes && origen ? `${origen}/tap/${slug}?k=${ajustes.secret}` : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAviso({ ok: false, texto: "No se pudo copiar. Selecciona el enlace y cópialo a mano." });
    }
  };

  const escribirEtiqueta = async () => {
    const lector = escritorNfc();
    if (!lector) {
      setAviso({ ok: false, texto: "Este navegador no puede escribir etiquetas. Usa Chrome en un celular Android, o copia el enlace y úsalo en una app como NFC Tools." });
      return;
    }
    setEscribiendo(true);
    setAviso({ ok: true, texto: "Acerca la etiqueta a la parte de atrás del celular…" });
    try {
      await lector.write({ records: [{ recordType: "url", data: enlace }] });
      setAviso({ ok: true, texto: "Etiqueta escrita. Pégala en el mostrador y pruébala acercando tu celular." });
    } catch {
      setAviso({ ok: false, texto: "No se pudo escribir. Acerca la etiqueta de nuevo y mantenla quieta unos segundos." });
    } finally {
      setEscribiendo(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Sellar con el celular (NFC)"
        description="Tu cliente acerca el celular a la tarjeta NFC del mostrador, escribe su número de celular y se registra su visita, sin pedirle nada al equipo."
      />
      <div className="space-y-5 p-5 text-sm">
        {cargando ? (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 className="size-4 animate-spin" /> Cargando…
          </p>
        ) : !ajustes ? (
          <p className="text-danger">{aviso?.texto ?? "No se pudieron cargar los ajustes."}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Permitir sellar con el toque</p>
                <p className={cn("text-xs", encendido ? "text-success" : "text-muted")}>
                  {encendido ? "Encendido: cada toque en la etiqueta suma un sello." : "Apagado, la etiqueta no registra nada."}
                </p>
              </div>
              <Switch checked={encendido} onChange={setEncendido} label="Permitir sellar con el toque del celular" />
            </div>

            <Field label="Tiempo mínimo entre toques" hint="Evita que alguien sume sellos sin comprar. Siempre se respeta también el tiempo mínimo de tu programa.">
              <Select value={espera} onChange={(e) => setEspera(Number(e.target.value))}>
                {ESPERAS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Sellos por día con el toque"
              hint="Cuántos sellos puede sumar una misma tarjeta en un día con la etiqueta. Con 1, quien guarde el enlace no puede sumar varias veces el mismo día."
            >
              <NumberInput value={porDia} min={1} max={20} onValueChange={setPorDia} className="max-w-24" aria-label="Sellos por día con el toque" />
            </Field>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Exigir estar en el local</p>
                <p className="text-xs text-muted">
                  {ajustes.canRequireLocation
                    ? "El celular del cliente debe estar a menos de 200 metros de una de tus sedes. Le pedimos permiso de ubicación; no la guardamos. Si no lo da, puedes sumarle el sello escaneando su QR."
                    : "Para activarlo, primero guarda la ubicación de al menos una sede (en Sedes)."}
                </p>
              </div>
              <Switch checked={exigir} onChange={setExigir} label="Exigir estar en el local para sumar con el toque" />
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
              <p className="mr-auto text-xs text-muted">{hayCambios ? "Tienes cambios sin guardar en el toque NFC." : "Los ajustes del toque están guardados."}</p>
              <Button variant="ghost" size="sm" onClick={() => mostrar(ajustes)} disabled={guardando || !hayCambios}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => void guardar()} disabled={guardando || !hayCambios}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar ajustes
              </Button>
            </div>

            <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
              La tarjeta NFC para tu mostrador te la entrega el equipo de Lazo en persona, lista para usar. Si se pierde o se daña, escríbenos.
            </p>

            {/* Grabar la etiqueta lo hace el equipo de Lazo (superadministrador dentro del comercio). */}
            {equipoLazo && (
              <>
                <div className="space-y-2">
                  <p className="font-medium">Enlace de la etiqueta</p>
                  <p className="rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs break-all text-muted select-all">{enlace || "…"}</p>
                  <p className="text-xs text-muted">Es secreto: no lo publiques. Solo debe estar dentro de la etiqueta del mostrador.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void copiar()} disabled={!enlace}>
                      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />} {copiado ? "Copiado" : "Copiar enlace"}
                    </Button>
                    <Button size="sm" onClick={() => void escribirEtiqueta()} disabled={!enlace || escribiendo}>
                      {escribiendo ? <Loader2 className="size-4 animate-spin" /> : <Nfc className="size-4" />} Escribir en una etiqueta
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm("Las etiquetas que ya escribiste dejarán de funcionar y tendrás que escribir una nueva. ¿Continuar?")) void guardar(true);
                      }}
                      disabled={guardando}
                    >
                      <RefreshCw className="size-4" /> Cambiar el secreto
                    </Button>
                  </div>
                </div>

                <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                  <li>Compra etiquetas NFC tipo NTAG213 o NTAG215 (calcomanías, pocos pesos cada una).</li>
                  <li>Con Chrome en un Android, pulsa «Escribir en una etiqueta» y acércala al celular.</li>
                  <li>Pégala en el mostrador, donde el cliente pueda tocarla.</li>
                  <li>Pruébala con tu propia tarjeta. Cada toque queda en el historial como visita por NFC y se puede revertir.</li>
                </ol>

              </>
            )}
          </>
        )}
        {aviso && ajustes && <p className={aviso.ok ? "text-success" : "text-danger"}>{aviso.texto}</p>}
      </div>
    </Card>
  );
}
