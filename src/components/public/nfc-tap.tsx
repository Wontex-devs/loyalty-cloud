"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Nfc } from "lucide-react";
import { nfcTapAction, type NfcTapResult } from "@/lib/data/nfc-actions";
import { LazoLogo } from "@/components/brand/lazo-logo";
import type { BusinessBranding } from "@/lib/domain/types";

/** Clave con la que la tarjeta pública guarda su enlace en este celular (ver card-screen.tsx). */
export const cardStorageKey = (slug: string) => `lazo:tarjeta:${slug}`;

export type EstadoToque =
  | { fase: "cargando" }
  | { fase: "sin-tarjeta" }
  | { fase: "enlace-invalido" }
  | { fase: "listo"; datos: Extract<NfcTapResult, { ok: true }> }
  | { fase: "error"; mensaje: string };

const nuevaClave = () => `nfc-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

/**
 * Pantalla que se abre al acercar el celular a la etiqueta NFC del mostrador.
 * Registra la visita de la tarjeta guardada en este celular y muestra el resultado.
 */
export function NfcTap({ slug, secret, business }: { slug: string; secret: string; business: { name: string; branding: BusinessBranding } }) {
  const [estado, setEstado] = useState<EstadoToque>({ fase: "cargando" });
  const [token, setToken] = useState<string | null>(null);
  const enviado = useRef(false);

  const registrar = async (cardToken: string) => {
    setEstado({ fase: "cargando" });
    try {
      const res = await nfcTapAction(slug, secret, cardToken, nuevaClave());
      setEstado(res.ok ? { fase: "listo", datos: res } : { fase: "error", mensaje: res.message });
    } catch {
      setEstado({ fase: "error", mensaje: "No pudimos conectar. Revisa tu internet e inténtalo de nuevo." });
    }
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
      /* sin almacenamiento: se trata como si no hubiera tarjeta */
    }
    if (!guardado) {
      setEstado({ fase: "sin-tarjeta" });
      return;
    }
    setToken(guardado);
    void registrar(guardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <NfcTapVista slug={slug} business={business} estado={estado} token={token} onReintentar={() => token && void registrar(token)} />;
}

/** Solo la parte visual, para poder verla en cada estado. */
export function NfcTapVista({
  slug,
  business,
  estado,
  token,
  onReintentar,
}: {
  slug: string;
  business: { name: string; branding: BusinessBranding };
  estado: EstadoToque;
  token: string | null;
  onReintentar?: () => void;
}) {
  const b = business.branding;
  const boton = "mt-6 flex h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-semibold transition-transform duration-150 active:scale-[0.97]";
  const botonPrincipal = { background: b.cardForeground, color: b.cardBackground };
  const botonSecundario = { border: `2px solid ${b.cardForeground}`, color: b.cardForeground };

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
            <p className="mt-2 text-lg">
              Llevas {estado.datos.stamps} de {estado.datos.required}
            </p>
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

        {estado.fase === "error" && (
          <>
            <Nfc className="mx-auto mt-10 size-14 opacity-70" aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold">No pudimos marcar tu visita</h1>
            <p className="mt-2 text-base">{estado.mensaje}</p>
            {token && (
              <>
                <button type="button" className={boton} style={botonPrincipal} onClick={onReintentar}>
                  Intentar de nuevo
                </button>
                <Link href={`/card/${token}`} className={`${boton} !mt-3`} style={botonSecundario}>
                  Ver mi tarjeta
                </Link>
              </>
            )}
          </>
        )}

        {estado.fase === "sin-tarjeta" && (
          <>
            <Nfc className="mx-auto mt-10 size-14 opacity-70" aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold">Aún no tienes tarjeta en este celular</h1>
            <p className="mt-2 text-base">Créala en un minuto y luego acerca el celular de nuevo para sumar tu sello.</p>
            <Link href={`/join/${slug}`} className={boton} style={botonPrincipal}>
              Crear mi tarjeta
            </Link>
            <p className="mt-4 text-sm opacity-75">Si ya la tienes, ábrela desde tu enlace una vez y vuelve a acercar el celular.</p>
          </>
        )}

        {estado.fase === "enlace-invalido" && (
          <>
            <Nfc className="mx-auto mt-10 size-14 opacity-70" aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold">Esta etiqueta no es válida</h1>
            <p className="mt-2 text-base">Pídele al negocio que registre tu visita en caja.</p>
          </>
        )}

        <p className="mt-10 flex items-baseline justify-center gap-1 text-[11px] opacity-50">Tecnología de <LazoLogo className="text-[13px]" /></p>
      </div>
    </main>
  );
}

/** Se muestra cuando el negocio no existe o la app corre en modo demostración. */
export function NfcTapUnavailable({ demo = false }: { demo?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Nfc className="size-14 text-muted" aria-hidden />
      <h1 className="mt-6 text-2xl font-semibold">{demo ? "El toque NFC no está en la demostración" : "Este programa no está disponible"}</h1>
      <p className="mt-2 max-w-sm text-muted">
        {demo ? "Funciona en la versión real: la clienta acerca el celular a la etiqueta del mostrador y suma su sello." : "Pídele al negocio que registre tu visita en caja."}
      </p>
    </main>
  );
}
