import { Check, Coffee, Crown, Flower2, Gem, Heart, Scissors, Sparkles, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessBranding, CardFont, StampIcon } from "@/lib/domain/types";

export const STAMP_ICON_COMPONENTS: Record<StampIcon, LucideIcon> = {
  check: Check,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  flower: Flower2,
  gem: Gem,
  crown: Crown,
  scissors: Scissors,
  coffee: Coffee,
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
  coffee: "Café",
};

/** Iconos que se ven mejor rellenos dentro del sello. */
export const FILLED_STAMP_ICONS = new Set<StampIcon>(["heart", "star"]);

/** Tipografías de la tarjeta: nombre para el panel y clases para el nombre del comercio. */
export const CARD_FONT_STYLES: Record<CardFont, { label: string; className: string; upper: boolean }> = {
  serif: { label: "Clásica", className: "font-serif", upper: true },
  sans: { label: "Moderna", className: "font-sans font-semibold tracking-[0.04em]", upper: true },
  elegante: { label: "Elegante", className: "font-[family-name:var(--font-card-elegante)] font-semibold tracking-[0.06em]", upper: true },
  manuscrita: { label: "Manuscrita", className: "font-[family-name:var(--font-card-manuscrita)] font-semibold", upper: false },
  redondeada: { label: "Redondeada", className: "font-[family-name:var(--font-card-redondeada)] font-bold tracking-[0.04em]", upper: true },
  impacto: { label: "Impacto", className: "font-[family-name:var(--font-card-impacto)] tracking-[0.08em]", upper: true },
  geometrica: { label: "Geométrica", className: "font-[family-name:var(--font-card-geometrica)] font-semibold tracking-[0.08em]", upper: true },
  // La letra que subió el comercio: la carga <FuenteMarca> en la página (variable --font-marca-propia).
  propia: { label: "Tu letra", className: "font-[family-name:var(--font-marca-propia)]", upper: false },
};

/**
 * Clases de la tipografía elegida para los títulos, incluida la mayúscula (la manuscrita va en minúsculas).
 * `serifTracking` es el espaciado extra de la clásica, que es más estrecha.
 */
export const brandFont = (b: Pick<BusinessBranding, "font">, serifTracking = "") => {
  const f = CARD_FONT_STYLES[b.font ?? "serif"] ?? CARD_FONT_STYLES.serif;
  return cn(f.className, b.font === "serif" || !b.font ? serifTracking : "");
};

/** Mayúsculas para el nombre del comercio, salvo en la letra manuscrita. */
export const brandCase = (b: Pick<BusinessBranding, "font">) => ((CARD_FONT_STYLES[b.font ?? "serif"] ?? CARD_FONT_STYLES.serif).upper ? "uppercase" : "");

/** El sello propio que subió el comercio, o el icono elegido. Va dentro del círculo relleno. */
export function StampMark({ branding, className, strokeWidth }: { branding: Pick<BusinessBranding, "stampIcon" | "stampUrl">; className?: string; strokeWidth?: number }) {
  if (branding.stampUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={branding.stampUrl} alt="" className={cn("rounded-full bg-white object-contain p-[12%]", className)} />;
  }
  const key = branding.stampIcon ?? "check";
  const Icon = STAMP_ICON_COMPONENTS[key] ?? STAMP_ICON_COMPONENTS.check;
  return (
    <Icon className={className} strokeWidth={strokeWidth ?? (key !== "check" ? 2 : 2.5)} fill={FILLED_STAMP_ICONS.has(key) ? "currentColor" : "none"} />
  );
}

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
        {/* La imagen llena el círculo (o el cuadro redondeado): lo que sobra en las esquinas se recorta. */}
        <img src={branding.logoUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center", className)} style={style}>
      {branding.logoText}
    </span>
  );
}

/**
 * Carga la letra propia del comercio en la página: define la familia y la variable
 * --font-marca-propia que usa la clase de «Tu letra». Sin letra propia no hace nada.
 */
export function FuenteMarca({ branding }: { branding: Pick<BusinessBranding, "font" | "fontUrl"> }) {
  const url = branding.fontUrl;
  // Dirección pública de su carpeta o, en el editor, la vista previa local («blob:») del archivo elegido.
  if (!url || !/^(https:\/\/|blob:https?:\/\/)[^\s"'()<>]+$/.test(url)) return null;
  const formato = url.endsWith(".otf") ? "opentype" : url.endsWith(".woff") ? "woff" : url.endsWith(".ttf") ? "truetype" : "";
  const src = formato ? `url("${url}") format("${formato}")` : `url("${url}")`;
  return <style>{`@font-face{font-family:"LazoLetraPropia";src:${src};font-display:swap}:root{--font-marca-propia:"LazoLetraPropia",ui-serif,serif}`}</style>;
}
