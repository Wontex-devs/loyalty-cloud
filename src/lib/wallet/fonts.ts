import "server-only";
import type { CardFont } from "@/lib/domain/types";

/**
 * Tipografías de la tarjeta para las imágenes de las billeteras (logo y franja de sellos).
 * Son las mismas de Google Fonts que usa la tarjeta web; se descargan como TTF la primera
 * vez y quedan en memoria. Si fallan, la imagen sale con la letra por defecto.
 */
const FAMILIES: Record<CardFont, { family: string; weight: number }> = {
  serif: { family: "Cormorant Garamond", weight: 500 },
  sans: { family: "Inter", weight: 600 },
  elegante: { family: "Playfair Display", weight: 600 },
  manuscrita: { family: "Dancing Script", weight: 600 },
  redondeada: { family: "Nunito", weight: 700 },
  impacto: { family: "Bebas Neue", weight: 400 },
  geometrica: { family: "Montserrat", weight: 600 },
};

/** Letra fina para títulos y etiquetas de la franja. */
const TITLE: { family: string; weight: number } = { family: "Cormorant Garamond", weight: 500 };

export interface ImageFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
}

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function download(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
      // Sin un navegador moderno, Google entrega TTF (el formato que entiende la imagen).
      headers: { "User-Agent": "Mozilla/4.0" },
    }).then((r) => (r.ok ? r.text() : ""));
    // El último bloque es el subconjunto latino (incluye tildes y ñ).
    const urls = [...css.matchAll(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/g)].map((m) => m[1]);
    const url = urls.at(-1);
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function load(family: string, weight: number) {
  const key = `${family}:${weight}`;
  let p = cache.get(key);
  if (!p) {
    p = download(family, weight).then((d) => {
      if (!d) cache.delete(key); // se reintenta la próxima vez
      return d;
    });
    cache.set(key, p);
  }
  return p;
}

/** Letra del nombre del comercio ("Marca") y letra de títulos ("Titulo") para la imagen. */
export async function walletFonts(font: CardFont | undefined): Promise<ImageFont[]> {
  const brand = FAMILIES[font ?? "serif"] ?? FAMILIES.serif;
  const [b, t, r, m, sb] = await Promise.all([
    load(brand.family, brand.weight),
    load(TITLE.family, TITLE.weight),
    load("Inter", 400),
    load("Inter", 500),
    load("Inter", 600),
  ]);
  // La primera es la letra por defecto de la imagen: la de textos, no la del nombre.
  const out: ImageFont[] = [];
  if (r) out.push({ name: "Texto", data: r, weight: 400, style: "normal" });
  if (m) out.push({ name: "Texto", data: m, weight: 500, style: "normal" });
  if (sb) out.push({ name: "Texto", data: sb, weight: 600, style: "normal" });
  if (t) out.push({ name: "Titulo", data: t, weight: TITLE.weight as ImageFont["weight"], style: "normal" });
  if (b) out.push({ name: "Marca", data: b, weight: brand.weight as ImageFont["weight"], style: "normal" });
  return out;
}
