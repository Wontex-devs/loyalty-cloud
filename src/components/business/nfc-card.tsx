"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Nfc, RefreshCw } from "lucide-react";
import { getNfcSettingsAction, setNfcSettingsAction, type NfcSettings } from "@/lib/data/nfc-actions";
import { Button, Card, CardHeader, Field, Select, Switch } from "@/components/ui";

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
 * Etiqueta NFC del mostrador: enciende el toque con el celular, muestra el enlace secreto y lo escribe en una etiqueta.
 */
export function NfcCard({ businessId, slug }: { businessId: string; slug: string }) {
  const [ajustes, setAjustes] = useState<NfcSettings | null>(null);
  const [espera, setEspera] = useState(120);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [origen, setOrigen] = useState("");

  useEffect(() => setOrigen(window.location.origin), []);

  useEffect(() => {
    let vivo = true;
    void getNfcSettingsAction(businessId).then((r) => {
      if (!vivo) return;
      setCargando(false);
      if (r.ok) {
        setAjustes(r.settings);
        setEspera(r.settings.minMinutes);
      } else setAviso({ ok: false, texto: r.message });
    });
    return () => {
      vivo = false;
    };
  }, [businessId]);

  const guardar = async (enabled: boolean, rotar = false) => {
    setGuardando(true);
    setAviso(null);
    const r = await setNfcSettingsAction(businessId, enabled, espera, rotar);
    setGuardando(false);
    if (r.ok) {
      setAjustes(r.settings);
      setAviso({ ok: true, texto: rotar ? "Listo: las etiquetas viejas dejaron de funcionar. Escribe la nueva." : "Guardado." });
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
        description="Pega una etiqueta en el mostrador. Tu cliente acerca el celular y se registra su visita, sin pedirle nada al equipo."
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
                <p className="text-xs text-muted">Apagado, la etiqueta no registra nada.</p>
              </div>
              <Switch checked={ajustes.enabled} onChange={(v) => void guardar(v)} label="Permitir sellar con el toque del celular" />
            </div>

            <Field label="Tiempo mínimo entre toques" hint="Evita que alguien sume sellos sin comprar. Siempre se respeta también el tiempo mínimo de tu programa.">
              <div className="flex gap-2">
                <Select value={espera} onChange={(e) => setEspera(Number(e.target.value))}>
                  {ESPERAS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button variant="secondary" onClick={() => void guardar(ajustes.enabled)} disabled={guardando || espera === ajustes.minMinutes}>
                  Guardar
                </Button>
              </div>
            </Field>

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
                    if (window.confirm("Las etiquetas que ya escribiste dejarán de funcionar y tendrás que escribir una nueva. ¿Continuar?")) void guardar(ajustes.enabled, true);
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
        {aviso && ajustes && <p className={aviso.ok ? "text-success" : "text-danger"}>{aviso.texto}</p>}
      </div>
    </Card>
  );
}
