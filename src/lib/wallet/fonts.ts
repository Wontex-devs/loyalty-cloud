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
  // Si la letra propia no se puede cargar, la imagen usa la clásica.
  propia: { family: "Cormorant Garamond", weight: 500 },
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
/** Las letras no cambian: se piden a Google una vez al mes como mucho, no en cada arranque del servidor. */
const MES = 60 * 60 * 24 * 30;

async function download(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
      // Sin un navegador moderno, Google entrega TTF (el formato que entiende la imagen).
      headers: { "User-Agent": "Mozilla/4.0" },
      cache: "force-cache",
      next: { revalidate: MES },
    }).then((r) => (r.ok ? r.text() : ""));
    // El último bloque es el subconjunto latino (incluye tildes y ñ).
    const urls = [...css.matchAll(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/g)].map((m) => m[1]);
    const url = urls.at(-1);
    if (!url) return null;
    const res = await fetch(url, { cache: "force-cache", next: { revalidate: MES } });
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

/** Letra propia del comercio (su archivo en Storage): se descarga una vez y queda en memoria. */
function loadPropia(url: string) {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url, { cache: "force-cache", next: { revalidate: MES } })
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.arrayBuffer();
        // La imagen entiende TTF, OTF y WOFF (no WOFF2); se revisa la firma del archivo.
        const firma = new Uint8Array(data.slice(0, 4));
        const ok = [[0, 1, 0, 0], [0x4f, 0x54, 0x54, 0x4f], [0x77, 0x4f, 0x46, 0x46], [0x74, 0x72, 0x75, 0x65]].some((f) => f.every((b, i) => firma[i] === b));
        return ok && data.byteLength <= 2_097_152 ? data : null;
      })
      .catch(() => null)
      .then((d) => {
        if (!d) cache.delete(url);
        return d;
      });
    cache.set(url, p);
  }
  return p;
}

/**
 * Letra del nombre del comercio ("Marca") y letra de títulos ("Titulo") para la imagen.
 * Con letra propia ("propia" + fontUrl), «Marca» es el archivo que subió el comercio.
 */
export async function walletFonts(font: CardFont | undefined, fontUrl?: string): Promise<ImageFont[]> {
  const brand = FAMILIES[font ?? "serif"] ?? FAMILIES.serif;
  const propia = font === "propia" && fontUrl?.startsWith("https://") ? fontUrl : null;
  const [b, t, r, m, sb] = await Promise.all([
    propia ? loadPropia(propia).then((d) => d ?? load(brand.family, brand.weight)) : load(brand.family, brand.weight),
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
