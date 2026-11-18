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
