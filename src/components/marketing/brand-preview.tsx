"use client";

import { useState } from "react";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { cn } from "@/lib/utils";
import type { BusinessBranding, StampIcon } from "@/lib/domain/types";

const brand = (logoText: string, cardBackground: string, cardForeground: string, accent: string, stampIcon: StampIcon, font: "serif" | "sans"): BusinessBranding => ({
  logoText,
  cardBackground,
  cardForeground,
  primary: cardForeground,
  primaryForeground: cardBackground,
  accent,
  stampIcon,
  font,
});

// Negocios de ejemplo: nombres inventados para mostrar la tarjeta.
const EXAMPLES = [
  { label: "Barbería", name: "Barbería Norte", reward: "Corte gratis", required: 6, stamps: 4, branding: brand("BN", "#1C2333", "#E8DCC4", "#C9B48A", "scissors", "sans") },
  { label: "Uñas", name: "Estudio Lila", reward: "Manicura gratis", required: 8, stamps: 5, branding: brand("EL", "#E3DCF0", "#2B2140", "#B8A6D9", "heart", "serif") },
  { label: "Cafetería", name: "Café de la Esquina", reward: "Café gratis", required: 8, stamps: 6, branding: brand("CE", "#EFE2C8", "#3A2E1C", "#C9A96E", "star", "serif") },
  { label: "Spa", name: "Casa Salvia", reward: "Masaje de 30 minutos", required: 6, stamps: 2, branding: brand("CS", "#D5DDCF", "#1E2A1E", "#A9B99E", "flower", "serif") },
  { label: "Panadería", name: "Miga & Horno", reward: "Pan de la casa", required: 10, stamps: 7, branding: brand("MH", "#E7C4AF", "#3B1F14", "#C97B5A", "check", "sans") },
];

/** Selector de negocios de ejemplo: usa la misma tarjeta que recibe el cliente. */
export function BrandPreview() {
  const [i, setI] = useState(0);
  const e = EXAMPLES[i];
  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Tipo de negocio">
        {EXAMPLES.map((x, n) => (
          <button
            key={x.label}
            type="button"
            aria-pressed={n === i}
            onClick={() => setI(n)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
              n === i ? "border-night bg-night text-cream" : "border-night/15 bg-white/60 text-night hover:border-night/40",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="mx-auto max-w-sm">
        <LoyaltyCardView
          business={{ name: e.name, branding: e.branding }}
          program={{ name: e.name, stampsRequired: e.required, rewardName: e.reward }}
          customerName="Laura Gómez"
          stamps={e.stamps}
          status="active"
          rewardsAvailable={0}
        />
      </div>
    </div>
  );
}
