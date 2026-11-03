import { Check, Crown, Flower2, Gem, Heart, Scissors, Sparkles, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessBranding, StampIcon } from "@/lib/domain/types";

export const STAMP_ICON_COMPONENTS: Record<StampIcon, LucideIcon> = {
  check: Check,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  flower: Flower2,
  gem: Gem,
  crown: Crown,
  scissors: Scissors,
};

export const STAMP_ICON_LABELS: Record<StampIcon, string> = {
  check: "Visto",
  heart: "Corazón",
  star: "Estrella",
  sparkles: "Brillo",
  flower: "Flor",
  gem: "Gema",
  crown: "Corona",
  scissors: "Tijeras",
};

/** Iconos que se ven mejor rellenos dentro del sello. */
export const FILLED_STAMP_ICONS = new Set<StampIcon>(["heart", "star"]);

/**
 * Clases de la tipografía elegida para los títulos. La moderna es más ancha,
 * así que lleva menos espaciado; `serifTracking` es el de la clásica.
 */
export const brandFont = (b: Pick<BusinessBranding, "font">, serifTracking = "") =>
  b.font === "sans" ? "font-sans font-semibold tracking-[0.04em]" : cn("font-serif", serifTracking);

/**
 * Logotipo del comercio: la imagen subida o, si no hay, el monograma.
 * `className` da el tamaño y la forma; `style` los colores del monograma.
 * El logo va sobre blanco para que se vea igual con cualquier color de tarjeta.
 */
export function BrandMark({
  branding,
  className,
  style,
}: {
  branding: Pick<BusinessBranding, "logoText" | "logoUrl">;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (branding.logoUrl) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={branding.logoUrl} alt="" className="size-full object-contain p-[10%]" />
      </span>
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center", className)} style={style}>
      {branding.logoText}
    </span>
  );
}
