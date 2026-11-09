"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { cn } from "@/lib/utils";
import type { BusinessBranding, StampIcon } from "@/lib/domain/types";

/**
 * Marca de cada local. `cover` es la foto de fondo del local (`public/locales/`; hoy son recortes de una captura, de baja resolución).
 * `logoUrl` es el logo (`public/logos/`); sin él, la tarjeta muestra el monograma.
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

// Locales de Barranquilla que ya son clientes. Colores, premios y clientes son de ejemplo hasta confirmarlos con cada local.
const EXAMPLES = [
  { name: "Botero's Barranquilla", club: "Club Botero's", customer: "Camila Pérez", reward: "Bebida de la casa gratis", required: 8, stamps: 5, branding: brand("B", "#2F6F4E", "#FFF3C9", "star", "serif"), cover: "/locales/botero.png" },
  { name: "La Gelatería", club: "Club Gelatería", customer: "Andrés Molina", reward: "Helado gratis", required: 6, stamps: 4, branding: brand("G", "#FCE7EF", "#5A2A3C", "heart", "sans"), cover: "/locales/gelateria.png" },
  { name: "Época Café Bar", club: "Club Época", customer: "Valentina Ríos", reward: "Café de especialidad gratis", required: 8, stamps: 6, branding: brand("É", "#EFE6D8", "#2B2B2B", "sparkles", "serif"), cover: "/locales/epoca.png" },
  { name: "Varadero", club: "Club Varadero", customer: "Mateo Gómez", reward: "Postre de la casa gratis", required: 10, stamps: 7, branding: brand("V", "#12355B", "#FFD166", "gem", "sans"), cover: "/locales/varadero.png" },
  { name: "La Matriarca", club: "Club La Matriarca", customer: "Sofía Vélez", reward: "Plato del día gratis", required: 8, stamps: 3, branding: brand("M", "#7A1F2B", "#FBE5C8", "crown", "serif"), cover: "/locales/matriarca.png" },
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
            coverUrl={e.cover}
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
        <p className="text-sm text-graphite">Locales de Barranquilla que ya usan Lazo. Los nombres de clientes son de ejemplo.</p>
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
