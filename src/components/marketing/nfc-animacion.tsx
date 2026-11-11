"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Nfc, Smartphone } from "lucide-react";

type Fase = "estatico" | "listo" | "reproduce";

/** Ilustración decorativa: el celular se acerca al lector y el sello se marca. Se reproduce una sola vez al entrar en pantalla. */
export function NfcAnimacion() {
  const ref = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<Fase>("estatico");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFase("listo");
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setFase("reproduce");
          observador.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden data-fase={fase} className="nfc-animacion relative mx-auto h-56 w-full max-w-sm">
      {/* Lector */}
      <div className="absolute right-4 top-1/2 flex size-28 -translate-y-1/2 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10">
        <Nfc className="size-12 text-white" strokeWidth={1.5} />
      </div>
      {/* Anillo */}
      <div className="absolute right-4 top-1/2 size-28 -translate-y-1/2">
        <span className="nfc-anillo block size-full rounded-2xl border-2 border-sun" />
      </div>
      {/* Celular */}
      <div className="absolute right-40 top-1/2 -translate-y-1/2">
        <span className="nfc-celular flex size-20 items-center justify-center rounded-2xl bg-white text-coal shadow-[0_14px_28px_-12px_rgb(6_10_36/0.6)]">
          <Smartphone className="size-10" strokeWidth={1.5} />
        </span>
      </div>
      {/* Sello */}
      <div className="absolute right-0 top-6">
        <span className="nfc-sello flex size-12 items-center justify-center rounded-full bg-sun text-coal">
          <Check className="size-6" strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}
