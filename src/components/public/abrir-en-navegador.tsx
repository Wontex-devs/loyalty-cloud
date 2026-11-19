"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { esNavegadorDeApp } from "@/lib/domain/recordar";

/**
 * Aviso cuando la página se abrió dentro de Instagram, WhatsApp, Facebook o TikTok. Ahí la tarjeta queda
 * guardada en esa app, y el toque NFC del mostrador abre Safari o Chrome, que no la conocen.
 * No bloquea la inscripción: solo invita a seguir en el navegador del celular.
 */
export function AbrirEnNavegador() {
  const [datos, setDatos] = useState<{ android: boolean; url: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!esNavegadorDeApp(navigator.userAgent)) return;
    setDatos({ android: /Android/i.test(navigator.userAgent), url: window.location.href });
  }, []);

  if (!datos) return null;

  // En Android, Chrome se puede abrir directamente; en iPhone hay que hacerlo a mano.
  const enChrome = `intent://${datos.url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(datos.url);
      setCopiado(true);
    } catch {
      /* sin portapapeles: la persona puede usar el menú de la app */
    }
  };

  return (
    <div role="note" className="mt-6 rounded-2xl bg-white p-4 text-left text-[#111111] shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
      <p className="text-sm font-semibold">Ábrelo en {datos.android ? "Chrome" : "Safari"} para sumar sellos con el toque</p>
      <p className="mt-1 text-xs leading-relaxed opacity-70">
        Estás en el navegador de otra app. Si creas tu tarjeta aquí, tu celular no la reconocerá al acercarlo a la etiqueta del negocio.
        {datos.android ? "" : " Toca los tres puntos (•••) de arriba y elige «Abrir en el navegador», o copia el enlace y pégalo en Safari."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {datos.android && (
          <a href={enChrome} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#111111] px-4 text-sm font-semibold text-white">
            <ExternalLink className="size-4" aria-hidden /> Abrir en Chrome
          </a>
        )}
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-[#111111] px-4 text-sm font-semibold"
        >
          {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copiado ? "Enlace copiado" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}
