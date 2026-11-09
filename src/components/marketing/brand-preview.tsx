"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { cn } from "@/lib/utils";
import type { BusinessBranding, StampIcon } from "@/lib/domain/types";

const brand = (logo: string, cardBackground: string, cardForeground: string, stampIcon: StampIcon, font: "serif" | "sans"): BusinessBranding => ({
  logoText: "",
  logoUrl: `/logos/${logo}.svg`,
  cardBackground,
  cardForeground,
  primary: cardForeground,
  primaryForeground: cardBackground,
  accent: cardForeground,
  stampIcon,
  font,
});

// Negocios inventados para mostrar la tarjeta. Solo usan lo que un comercio puede configurar.
const EXAMPLES = [
  { name: "Barbería El Faro", club: "Club del Faro", kind: "Barbería", customer: "Andrés Ruiz", reward: "Corte y barba gratis", required: 6, stamps: 4, logo: "el-faro", branding: brand("el-faro", "#1C2333", "#F0D58C", "scissors", "sans") },
  { name: "Estudio Lila", club: "Club Lila", kind: "Uñas", customer: "Valentina Ríos", reward: "Manicura semipermanente", required: 8, stamps: 5, logo: "estudio-lila", branding: brand("estudio-lila", "#E3DCF0", "#2B2140", "sparkles", "serif") },
  { name: "Café de la Esquina", club: "Los del café", kind: "Cafetería", customer: "Camilo Pérez", reward: "Capuchino de la casa", required: 8, stamps: 6, logo: "cafe-esquina", branding: brand("cafe-esquina", "#EFE2C8", "#4A2F1C", "star", "serif") },
  { name: "Casa Salvia", club: "Ritual Salvia", kind: "Spa", customer: "Mariana Díaz", reward: "Masaje de 30 minutos", required: 6, stamps: 2, logo: "casa-salvia", branding: brand("casa-salvia", "#2E4A35", "#E4EBDD", "flower", "serif") },
  { name: "Miga & Horno", club: "La docena del horno", kind: "Panadería", customer: "Sofía Vélez", reward: "Pan de masa madre", required: 10, stamps: 7, logo: "miga-horno", branding: brand("miga-horno", "#E7C4AF", "#3B1F14", "heart", "sans") },
];

/**
 * Carrusel de negocios de ejemplo: usa la misma tarjeta que recibe el cliente.
 * Pasa solo cuando está a la vista y se detiene al pasar el cursor, al enfocar, al elegir un negocio o al pulsar «Pausar».
 * Con «reducir movimiento» no avanza solo.
 */
export function BrandPreview() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [encima, setEncima] = useState(false);
  const [reducir, setReducir] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const toqueX = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducir(true);
      setAuto(false);
    }
    const el = raiz.current;
    if (!el) return;
    const observador = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.5 });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const elegir = (n: number) => {
    setI((n + EXAMPLES.length) % EXAMPLES.length);
  };
  const corriendo = auto && visible && !encima;

  return (
    <div
      ref={raiz}
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      onFocus={() => setEncima(true)}
      onBlur={() => setEncima(false)}
    >
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Tipo de negocio">
        {EXAMPLES.map((x, n) => (
          <button
            key={x.kind}
            type="button"
            aria-pressed={n === i}
            onClick={() => {
              setAuto(false);
              elegir(n);
            }}
            className={cn(
              "relative flex h-12 items-center gap-2 overflow-hidden rounded-lg border-2 bg-white pl-1.5 pr-3.5 text-[15px] font-semibold transition-[color,border-color,transform] duration-150 active:scale-[0.97]",
              n === i ? "border-cobalt text-coal" : "border-cobalt/20 text-coal hover:border-cobalt",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/logos/${x.logo}.svg`} alt="" className="size-9" />
            {x.kind}
            {n === i && auto && (
              <span
                key={i}
                aria-hidden
                className="carrusel-progreso absolute inset-x-0 bottom-0 h-[3px] bg-cobalt"
                style={{ animationPlayState: corriendo ? "running" : "paused" }}
                onAnimationEnd={() => elegir(i + 1)}
              />
            )}
          </button>
        ))}
      </div>

      <div className="max-w-sm">
        {/* Pista del carrusel: las cinco tarjetas en fila; se desliza una posición por vez. */}
        <div
          className="overflow-x-clip"
          onTouchStart={(e) => {
            toqueX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (toqueX.current === null) return;
            const dx = e.changedTouches[0].clientX - toqueX.current;
            toqueX.current = null;
            if (Math.abs(dx) > 40) {
              setAuto(false);
              elegir(i + (dx < 0 ? 1 : -1));
            }
          }}
        >
          <div
            className="flex transition-transform duration-500 ease-[var(--ease-ui-in-out)] motion-reduce:transition-none"
            style={{ transform: `translateX(-${i * 100}%)` }}
          >
            {EXAMPLES.map((e, n) => (
              <div key={e.kind} className="w-full shrink-0" aria-hidden={n !== i} inert={n !== i}>
                <LoyaltyCardView
                  business={{ name: e.name, branding: e.branding }}
                  program={{ name: e.club, stampsRequired: e.required, rewardName: e.reward }}
                  customerName={e.customer}
                  stamps={e.stamps}
                  status="active"
                  rewardsAvailable={0}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-graphite">Negocios inventados para mostrar la tarjeta.</p>
          {!reducir && (
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-cobalt transition-transform duration-150 hover:bg-cobalt/10 active:scale-[0.97]"
            >
              {auto ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {auto ? "Pausar" : "Reanudar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
