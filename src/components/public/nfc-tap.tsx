"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, MapPin, Nfc } from "lucide-react";
import { nfcRecuperarAction, nfcTapAction, type NfcTapResult, type Ubicacion } from "@/lib/data/nfc-actions";
import { LazoLogo } from "@/components/brand/lazo-logo";
import type { BusinessBranding } from "@/lib/domain/types";

/** Clave con la que la tarjeta pública guarda su enlace en este celular (ver card-screen.tsx). */
export const cardStorageKey = (slug: string) => `lazo:tarjeta:${slug}`;

export type EstadoToque =
  | { fase: "cargando" }
  | { fase: "sin-tarjeta" }
  | { fase: "enlace-invalido" }
  | { fase: "listo"; datos: Extract<NfcTapResult, { ok: true }> }
  | { fase: "ubicacion"; buscando?: boolean; problema?: string }
  | { fase: "error"; mensaje: string; motivo?: "pronto" | "etiqueta" | "ubicacion" | "lejos" };

export type DatosCliente = { celular: string };

const nuevaClave = () => `nfc-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

const guardarEnCelular = (slug: string, token: string) => {
  try {
    localStorage.setItem(cardStorageKey(slug), token);
  } catch {
    /* sin almacenamiento: queda la cookie del servidor */
  }
};

/**
 * Pantalla que se abre al acercar el celular a la etiqueta NFC del mostrador.
 * Busca la tarjeta de este celular (en la página o en la cookie del servidor) y registra la visita.
 * Si no la encuentra, el cliente confirma su nombre y celular y el sello se suma en ese momento.
 */
export function NfcTap({ slug, secret, business }: { slug: string; secret: string; business: { name: string; branding: BusinessBranding } }) {
  const [estado, setEstado] = useState<EstadoToque>({ fase: "cargando" });
  const [token, setToken] = useState<string | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviado = useRef(false);
  // La misma clave en los reintentos: si la respuesta se perdió, la base reconoce la visita y no suma dos veces.
  const claveToque = useRef(nuevaClave());
  const claveCelular = useRef<{ celular: string; clave: string } | null>(null);
  // Solo si el comercio exige estar en el local: la ubicación de este momento y lo que quedó pendiente de reintentar.
  const ubicacion = useRef<Ubicacion | undefined>(undefined);
  const pendiente = useRef<{ tipo: "toque"; token: string | null } | { tipo: "celular"; datos: DatosCliente } | null>(null);

  const mostrar = (res: NfcTapResult) => {
    if (res.ok) {
      if (res.token) {
        guardarEnCelular(slug, res.token);
        setToken(res.token);
      }
      setEstado({ fase: "listo", datos: res });
      return;
    }
    if (res.sinTarjeta) {
      setEstado({ fase: "sin-tarjeta" });
      return;
    }
    if (res.motivo === "ubicacion") {
      setEstado({ fase: "ubicacion" });
      return;
    }
    if (res.token) {
      guardarEnCelular(slug, res.token);
      setToken(res.token);
    }
    setEstado({ fase: "error", mensaje: res.message, motivo: res.motivo });
  };

  const registrar = async (cardToken: string | null) => {
    setEstado({ fase: "cargando" });
    pendiente.current = { tipo: "toque", token: cardToken };
    try {
      mostrar(await nfcTapAction(slug, secret, cardToken, claveToque.current, ubicacion.current));
    } catch {
      setEstado({ fase: "error", mensaje: "No pudimos conectar. Revisa tu internet e inténtalo de nuevo." });
    }
  };

  const confirmar = async (datos: DatosCliente) => {
    setEnviando(true);
    setErrorDatos(null);
    const digitos = datos.celular.replace(/\D/g, "");
    if (claveCelular.current?.celular !== digitos) claveCelular.current = { celular: digitos, clave: nuevaClave() };
    try {
      pendiente.current = { tipo: "celular", datos };
      const res = await nfcRecuperarAction(slug, secret, datos, claveCelular.current.clave, ubicacion.current);
      // Falta la ubicación o está lejos: pantalla aparte. Número que no está u otro error: se queda en el formulario.
      if (!res.ok && (res.motivo === "ubicacion" || res.motivo === "lejos")) mostrar(res);
      else if (!res.ok) setErrorDatos(res.message);
      else mostrar(res);
    } catch {
      setErrorDatos("No pudimos conectar. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  /** Pide la ubicación al celular (el navegador muestra su permiso) y repite lo que quedó pendiente. */
  const compartirUbicacion = () => {
    if (!("geolocation" in navigator)) {
      setEstado({ fase: "ubicacion", problema: "Este navegador no puede compartir la ubicación. Pídele a quien te atiende que sume tu sello." });
      return;
    }
    setEstado({ fase: "ubicacion", buscando: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ubicacion.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const p = pendiente.current;
        if (p?.tipo === "celular") {
          setEstado({ fase: "sin-tarjeta" });
          void confirmar(p.datos);
        } else void registrar(p?.tipo === "toque" ? p.token : token);
      },
      (err) =>
        setEstado({
          fase: "ubicacion",
          problema:
            err.code === err.PERMISSION_DENIED
              ? "No tenemos permiso para ver tu ubicación. Actívalo en los ajustes del navegador para este sitio, o pídele a quien te atiende que sume tu sello."
              : "No pudimos encontrar tu ubicación. Revisa que el GPS esté encendido e inténtalo de nuevo.",
        }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  useEffect(() => {
    // Una sola vez por apertura (en desarrollo React ejecuta los efectos dos veces).
    if (enviado.current) return;
    enviado.current = true;
    if (!secret) {
      setEstado({ fase: "enlace-invalido" });
      return;
    }
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(cardStorageKey(slug));
    } catch {
      /* sin almacenamiento: el servidor busca en su cookie */
    }
    if (guardado) setToken(guardado);
    // Aunque la página no recuerde la tarjeta, el servidor la busca en su cookie.
    void registrar(guardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NfcTapVista
      slug={slug}
      business={business}
      estado={estado}
      token={token}
      onReintentar={() => {
        // Tras «estás lejos» se pide de nuevo la ubicación (pudo haber salido mal la primera vez).
        if (estado.fase === "error" && estado.motivo === "lejos") compartirUbicacion();
        else void registrar(token);
      }}
      onConfirmar={confirmar}
      onUbicacion={compartirUbicacion}
      enviando={enviando}
      errorDatos={errorDatos}
    />
  );
}

/** Solo la parte visual, para poder verla en cada estado. */
export function NfcTapVista({
  slug,
  business,
  estado,
  token,
  onReintentar,
  onConfirmar,
  onUbicacion,
  enviando = false,
  errorDatos = null,
}: {
  slug: string;
  business: { name: string; branding: BusinessBranding };
  estado: EstadoToque;
  token: string | null;
  onReintentar?: () => void;
  onConfirmar?: (datos: DatosCliente) => void;
  onUbicacion?: () => void;
  enviando?: boolean;
  errorDatos?: string | null;
}) {
  const b = business.branding;
  const boton = "mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-60";
  const botonPrincipal = { background: b.cardForeground, color: b.cardBackground };
  const botonSecundario = { border: `2px solid ${b.cardForeground}`, color: b.cardForeground };
  const campo =
    "h-12 w-full rounded-xl border-2 bg-transparent px-4 text-base outline-none placeholder:opacity-60 focus:border-current";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10" style={{ background: b.cardBackground, color: b.cardForeground }}>
      <div className="w-full max-w-sm text-center" aria-live="polite">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-70">{business.name}</p>

        {estado.fase === "cargando" && (
          <>
            <Loader2 className="mx-auto mt-10 size-14 animate-spin" aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold">Registrando tu visita…</h1>
          </>
        )}

        {estado.fase === "listo" && (
          <>
            <span
              className="animate-stamp mx-auto mt-10 flex size-24 items-center justify-center rounded-full motion-reduce:animate-none"
              style={botonPrincipal}
            >
              <Check className="size-12" strokeWidth={3} aria-hidden />
            </span>
            <h1 className="mt-6 text-3xl font-semibold">¡Sello registrado!</h1>
            {estado.datos.sinDetalle ? (
              <p className="mt-2 text-base">Mira tus sellos en tu tarjeta de la billetera.</p>
            ) : (
              <p className="mt-2 text-lg">
                Llevas {estado.datos.stamps} de {estado.datos.required}
              </p>
            )}
            {estado.datos.rewardReady && (
              <p className="mt-4 rounded-xl px-4 py-3 text-base font-medium" style={{ background: `${b.cardForeground}1a` }}>
                Tienes un premio listo: {estado.datos.rewardName}. Muéstralo en caja.
              </p>
            )}
            {token && (
              <Link href={`/card/${token}`} className={boton} style={botonPrincipal}>
                Ver mi tarjeta
              </Link>
            )}
          </>
        )}

        {/* El comercio exige estar en el local: se explica antes de que el navegador pida el permiso. */}
        {estado.fase === "ubicacion" && (
          <>
            <span className="mx-auto mt-10 flex size-24 items-center justify-center rounded-full" style={{ background: `${b.cardForeground}1a` }}>
              <MapPin className="size-11" aria-hidden />
            </span>
            <h1 className="mt-6 text-2xl font-semibold">Confirma que estás en el local</h1>
            <p className="mt-2 text-base">Para sumar tu sello comprobamos que estás aquí. Solo se usa en este momento y no se guarda.</p>
            {estado.problema && (
              <p role="alert" className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: `${b.cardForeground}1a` }}>
                {estado.problema}
              </p>
            )}
            <button type="button" className={boton} style={botonPrincipal} onClick={onUbicacion} disabled={estado.buscando}>
              {estado.buscando ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <MapPin className="size-5" aria-hidden />}
              {estado.buscando ? "Buscando tu ubicación…" : estado.problema ? "Intentar de nuevo" : "Compartir mi ubicación"}
            </button>
          </>
        )}

        {/* Ya sumó hace poco: no es una falla, es una buena noticia. */}
        {estado.fase === "error" && estado.motivo === "pronto" && (
          <>
            <span className="mx-auto mt-10 flex size-24 items-center justify-center rounded-full" style={{ background: `${b.cardForeground}1a` }}>
              <Clock className="size-11" aria-hidden />
            </span>
            <h1 className="mt-6 text-2xl font-semibold">Tu sello de hoy ya está</h1>
            <p className="mt-2 text-base">{estado.mensaje}</p>
            {token && (
              <Link href={`/card/${token}`} className={boton} style={botonPrincipal}>
                Ver mi tarjeta
              </Link>
            )}
          </>
        )}

        {estado.fase === "error" && estado.motivo !== "pronto" && (
          <>
            <Nfc className="mx-auto mt-10 size-14 opacity-70" aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold">{estado.motivo === "lejos" ? "Acércate al mostrador" : "No pudimos marcar tu visita"}</h1>
            <p className="mt-2 text-base">{estado.mensaje}</p>
            {/* Reintentar sirve siempre, salvo si la etiqueta no es válida. Sin tarjeta guardada, el servidor la busca en su cookie. */}
            {estado.motivo !== "etiqueta" && (
              <button type="button" className={boton} style={botonPrincipal} onClick={onReintentar}>
                Intentar de nuevo
              </button>
            )}
            {estado.motivo === "etiqueta" && <p className="mt-4 text-sm opacity-75">Avísale a quien te atiende para que sume tu sello.</p>}
            {token && (
              <Link href={`/card/${token}`} className={`${boton} ${estado.motivo === "etiqueta" ? "" : "!mt-3"}`} style={estado.motivo === "etiqueta" ? botonPrincipal : botonSecundario}>
                Ver mi tarjeta
              </Link>
            )}
          </>
        )}

        {estado.fase === "sin-tarjeta" && (
          <>
            <h1 className="mt-8 text-2xl font-semibold">Escribe tu celular</h1>
            <p className="mt-2 text-base">El mismo con el que te inscribiste. Sumamos tu sello ahora mismo.</p>
            <form
              className="mt-6 space-y-3 text-left"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                onConfirmar?.({ celular: String(f.get("celular") ?? "") });
              }}
            >
              {/* autocomplete="tel": el celular ofrece el número de su dueño con un toque. */}
              <label className="block">
                <span className="sr-only">Celular</span>
                <input
                  name="celular"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  autoFocus
                  placeholder="Tu celular"
                  className={`${campo} text-center text-lg tracking-wide`}
                  style={{ borderColor: `${b.cardForeground}66` }}
                />
              </label>
              {errorDatos && (
                <p role="alert" className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: `${b.cardForeground}1a` }}>
                  {errorDatos}
                </p>
              )}
              <button type="submit" className={`${boton} !mt-4`} style={botonPrincipal} disabled={enviando}>
                {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />} Sumar mi sello
              </button>
            </form>
            <Link href={`/join/${slug}`} className={`${boton} !mt-6`} style={botonSecundario}>
              Es mi primera vez: crear mi tarjeta
            </Link>
          </>
        )}

        {estado.fase === "enlace-invalido" && (
          <>
            <Nfc className="mx-auto mt-10 size-14 opacity-70" aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold">Esta etiqueta no es válida</h1>
            <p className="mt-2 text-base">Avísale al negocio para que revise la etiqueta.</p>
          </>
        )}

        <p className="mt-10 flex items-baseline justify-center gap-1 text-[11px] opacity-50">Tecnología de <LazoLogo className="text-[13px]" /></p>
      </div>
    </main>
  );
}

/** Se muestra cuando el negocio no existe. */
export function NfcTapUnavailable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Nfc className="size-14 text-muted" aria-hidden />
      <h1 className="mt-6 text-2xl font-semibold">Este programa no está disponible</h1>
      <p className="mt-2 max-w-sm text-muted">
        Avísale al negocio para que revise la etiqueta.
      </p>
    </main>
  );
}
