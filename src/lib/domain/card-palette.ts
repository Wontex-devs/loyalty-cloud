/**
 * Paleta de la tarjeta a partir de los dos colores que elige el comercio.
 * El texto siempre se lee bien (blanco o casi negro según el fondo) y el color
 * de acento se reserva para los sellos, la barra de progreso y los detalles.
 * La usan la tarjeta web, la imagen de sellos de las billeteras y el pase de Apple.
 */

export interface CardPalette {
  /** Fondo de la tarjeta. */
  bg: string;
  /** Texto principal: blanco o casi negro, el que mejor se lea sobre el fondo. */
  text: string;
  /** Texto secundario (etiquetas y detalles). */
  muted: string;
  /** Sellos, barra y detalles: el color del comercio si se distingue del fondo. */
  accent: string;
  /** Icono dentro del sello relleno. */
  onAccent: string;
  /** Círculo de un sello por ganar. */
  slot: string;
  slotBorder: string;
}

const DARK = "#16130F";
const LIGHT = "#FFFFFF";

export function hex6(hex: string, fallback = "#000000") {
  let h = (hex ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toUpperCase()}` : fallback;
}

function channels(hex: string) {
  const n = parseInt(hex6(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa (WCAG). */
export function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Blanco o casi negro, el que más contraste tenga con el color dado. */
export const readableOn = (hex: string) => (contrast(hex, LIGHT) >= contrast(hex, DARK) ? LIGHT : DARK);

/** Color con transparencia en formato rgba(), para fondos y bordes suaves. */
export function alpha(hex: string, a: number) {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function cardPalette(b: { cardBackground: string; cardForeground: string }): CardPalette {
  const bg = hex6(b.cardBackground, "#EBCFCB");
  const text = readableOn(bg);
  const brand = hex6(b.cardForeground, text);
  // Si el color del comercio casi no se distingue del fondo, los sellos usan el color del texto.
  const accent = contrast(brand, bg) >= 1.8 ? brand : text;
  return {
    bg,
    text,
    muted: alpha(text, 0.68),
    accent,
    onAccent: readableOn(accent),
    slot: alpha(text, 0.1),
    slotBorder: alpha(text, 0.22),
  };
}

// ---------- Estilos de tarjeta ----------

export const CARD_STYLES = ["clasico", "noche", "cristal", "negro"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const CARD_STYLE_INFO: Record<CardStyle, { label: string; description: string }> = {
  clasico: { label: "Clásico", description: "Tus colores tal cual, con la foto arriba." },
  noche: { label: "Noche y oro", description: "Tu color en tono profundo con detalles dorados." },
  cristal: { label: "Cristal", description: "Tu foto de fondo y los sellos sobre vidrio." },
  negro: { label: "Negro mate", description: "Negro elegante; tu color solo en los sellos." },
};

/** Oro metálico de los estilos premium. */
export const GOLD = "#E8C873";
export const GOLD_GRADIENT = "linear-gradient(135deg, #F6E3A1 0%, #D9B45A 35%, #B8892E 60%, #F2D88A 100%)";
const GOLD_INK = "#2A1F08";

/** Mezcla dos colores: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  const h = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`.toUpperCase();
}

export interface CardTheme extends CardPalette {
  style: CardStyle;
  /** Fondo en CSS (degradado). `bg` es el color sólido equivalente para las billeteras. */
  bgCss: string;
  /** Relleno de los sellos ganados y de la barra (puede ser un degradado dorado). */
  accentCss: string;
  /** Etiquetas pequeñas (MIEMBRO, PREMIO…). */
  label: string;
  /** Marco fino alrededor de la tarjeta (solo Noche y oro). */
  frame: string | null;
  /** Cómo se usa la foto del local. */
  photo: "fade" | "tint" | "full" | "none";
  /** Velo sobre la foto en el estilo Cristal. */
  veil: string;
  /** Sellos y progreso sobre un panel de vidrio. */
  glass: boolean;
}

export function cardTheme(b: { cardBackground: string; cardForeground: string; cardStyle?: CardStyle | string | null }): CardTheme {
  const style: CardStyle = (CARD_STYLES as readonly string[]).includes(b.cardStyle ?? "") ? (b.cardStyle as CardStyle) : "clasico";
  const base = cardPalette(b);
  const brand = hex6(b.cardForeground, base.accent);
  const color = hex6(b.cardBackground, "#EBCFCB");
  const white = { text: LIGHT, muted: alpha(LIGHT, 0.62), slot: alpha(LIGHT, 0.08), slotBorder: alpha(LIGHT, 0.2) };

  if (style === "noche") {
    const deep = mix(color, "#000000", luminance(color) > 0.4 ? 0.62 : 0.5);
    const lift = mix(color, "#000000", 0.15);
    return {
      ...base,
      ...white,
      style,
      bg: deep,
      bgCss: `radial-gradient(120% 90% at 0% 0%, ${lift} 0%, ${deep} 55%, ${mix(deep, "#000000", 0.45)} 100%)`,
      accent: GOLD,
      accentCss: GOLD_GRADIENT,
      onAccent: GOLD_INK,
      label: GOLD,
      slotBorder: alpha(GOLD, 0.35),
      frame: GOLD_GRADIENT,
      photo: "tint",
      veil: "",
      glass: false,
    };
  }
  if (style === "negro") {
    const ink = "#111114";
    const accent = contrast(brand, ink) >= 3 ? brand : GOLD;
    return {
      ...base,
      ...white,
      style,
      bg: ink,
      bgCss: "linear-gradient(160deg, #26262B 0%, #111114 55%, #050506 100%)",
      accent,
      accentCss: accent,
      onAccent: readableOn(accent),
      label: alpha(LIGHT, 0.42),
      slot: "transparent",
      slotBorder: alpha(LIGHT, 0.14),
      frame: null,
      photo: "none",
      veil: "",
      glass: false,
    };
  }
  if (style === "cristal") {
    const deep = mix(color, "#000000", 0.55);
    const accent = contrast(brand, deep) >= 3 ? brand : LIGHT;
    return {
      ...base,
      ...white,
      style,
      bg: deep,
      bgCss: `linear-gradient(160deg, ${mix(color, "#000000", 0.2)} 0%, ${deep} 100%)`,
      accent,
      accentCss: accent,
      onAccent: readableOn(accent),
      label: alpha(LIGHT, 0.7),
      slot: alpha(LIGHT, 0.14),
      slotBorder: alpha(LIGHT, 0.3),
      frame: null,
      photo: "full",
      veil: `linear-gradient(180deg, ${alpha(deep, 0.3)} 0%, ${alpha(deep, 0.78)} 100%)`,
      glass: true,
    };
  }
  return {
    ...base,
    style,
    bgCss: `linear-gradient(140deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.14) 100%), ${base.bg}`,
    accentCss: base.accent,
    label: base.muted,
    frame: null,
    photo: "fade",
    veil: "",
    glass: false,
  };
}
