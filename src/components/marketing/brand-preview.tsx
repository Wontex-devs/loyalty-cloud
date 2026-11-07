"use client";

import { useState } from "react";
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

/** Selector de negocios de ejemplo: usa la misma tarjeta que recibe el cliente. */
export function BrandPreview() {
  const [i, setI] = useState(0);
  const e = EXAMPLES[i];
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Tipo de negocio">
        {EXAMPLES.map((x, n) => (
          <button
            key={x.kind}
            type="button"
            aria-pressed={n === i}
            onClick={() => setI(n)}
            className={cn(
              "flex h-12 items-center gap-2 rounded-lg border-2 bg-white pl-1.5 pr-3.5 text-[15px] font-semibold transition-colors",
              n === i ? "border-cobalt text-coal" : "border-cobalt/20 text-coal hover:border-cobalt",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/logos/${x.logo}.svg`} alt="" className="size-9" />
            {x.kind}
          </button>
        ))}
      </div>
      <div className="max-w-sm">
        <LoyaltyCardView
          business={{ name: e.name, branding: e.branding }}
          program={{ name: e.club, stampsRequired: e.required, rewardName: e.reward }}
          customerName={e.customer}
          stamps={e.stamps}
          status="active"
          rewardsAvailable={0}
        />
        <p className="mt-3 text-sm text-graphite">Negocios inventados para mostrar la tarjeta.</p>
      </div>
    </div>
  );
}
