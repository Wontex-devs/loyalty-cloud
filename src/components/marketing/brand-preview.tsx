"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { cn } from "@/lib/utils";
import type { BusinessBranding, StampIcon } from "@/lib/domain/types";

/**
 * Marca de cada negocio de ejemplo. Sin `logoUrl`, la tarjeta muestra el monograma.
 */
const brand = (
  logoText: string,
  cardBackground: string,
  cardForeground: string,
  stampIcon: StampIcon,
  font: "serif" | "sans",
  logoUrl?: string,
): BusinessBranding => ({
  logoText,
  logoUrl,
  cardBackground,
  cardForeground,
  primary: cardForeground,
  primaryForeground: cardBackground,
  accent: cardForeground,
  stampIcon,
  font,
});

// Negocios y clientes FICTICIOS, solo para mostrar cómo se ve una tarjeta. No representan a ningún cliente real.
const EXAMPLES = [
  { name: "Café Brisa Norte", club: "Club Brisa", customer: "Camila Pérez", reward: "Bebida de la casa gratis", required: 8, stamps: 5, branding: brand("B", "#2F6F4E", "#FFF3C9", "star", "serif") },
  { name: "Heladería Lunita", club: "Club Lunita", customer: "Andrés Molina", reward: "Helado gratis", required: 6, stamps: 4, branding: brand("L", "#FCE7EF", "#5A2A3C", "heart", "sans") },
  { name: "Tostadores del Puerto", club: "Club Tostadores", customer: "Valentina Ríos", reward: "Café de especialidad gratis", required: 8, stamps: 6, branding: brand("T", "#EFE6D8", "#2B2B2B", "sparkles", "serif") },
  { name: "Mar y Sal", club: "Club Mar y Sal", customer: "Mateo Gómez", reward: "Postre de la casa gratis", required: 10, stamps: 7, branding: brand("M", "#12355B", "#FFD166", "gem", "sans") },
  { name: "Cocina de la Abuela", club: "Club Abuela", customer: "Sofía Vélez", reward: "Plato del día gratis", required: 8, stamps: 3, branding: brand("C", "#7A1F2B", "#FBE5C8", "crown", "serif") },
];

/** Un juego completo de tarjetas. El segundo se repite para que el carrusel no tenga corte; ese va oculto para lectores de pantalla. */
function Juego({ copia = false }: { copia?: boolean }) {
  return (
    <div className={cn("flex gap-5 pr-5", copia && "marquee-copia")} aria-hidden={copia || undefined} inert={copia}>
      {EXAMPLES.map((e) => (
        <div key={e.name} className="w-[300px] shrink-0 sm:w-[340px]">
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
  );
}

/**
 * Carrusel horizontal continuo con los locales a la vez, de borde a borde de la pantalla.
 * Se detiene al pasar el cursor o con el botón «Pausar». Con «reducir movimiento» no se mueve: queda una fila que se desplaza a mano.
 */
export function BrandPreview() {
  const [pausado, setPausado] = useState(false);

  return (
    <div>
      <div className={cn("marquee py-8", pausado && "marquee-pausado")}>
        <div className="marquee-pista flex w-max">
          <Juego />
          <Juego copia />
        </div>
      </div>
      <div className="mx-auto mt-2 flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <p className="text-sm text-graphite">Ejemplos con negocios y clientes ficticios. Cada negocio diseña su propia tarjeta.</p>
        <button
          type="button"
          onClick={() => setPausado((p) => !p)}
          className="marquee-boton inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-cobalt transition-transform duration-150 hover:bg-cobalt/10 active:scale-[0.97]"
        >
          {pausado ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {pausado ? "Reanudar" : "Pausar"}
        </button>
      </div>
    </div>
  );
}
