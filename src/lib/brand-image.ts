/** Tamaño máximo del archivo que el usuario puede elegir (luego se reduce). */
export const LOGO_MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Límite del bucket brand-assets. */
const MAX_SALIDA_BYTES = 1024 * 1024;

const FONDO_LOGO_CLARO = "#0e1a52";

function comprobar(file: File) {
  if (!/^image\/(png|jpe?g|webp|svg\+xml|gif|avif|heic|heif)$/.test(file.type)) {
    throw new Error("Usa una imagen PNG, JPG, WebP o SVG.");
  }
  if (file.size > LOGO_MAX_INPUT_BYTES) throw new Error("La imagen pesa más de 8 MB.");
}

async function cargar(url: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode().catch(() => {
    throw new Error("No se pudo leer la imagen. Prueba con otro archivo.");
  });
  return img;
}

const aBlob = (canvas: HTMLCanvasElement, tipo: string, calidad?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Tu navegador no pudo procesar la imagen."))), tipo, calidad),
  );

function lienzo(ancho: number, alto: number) {
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

type Analisis = { x: number; y: number; ancho: number; alto: number; claroSobreTransparente: boolean };

/** Busca dónde está el dibujo: quita los márgenes vacíos y detecta logos claros que se perderían sobre blanco. */
function analizar(img: HTMLImageElement, w: number, h: number): Analisis | null {
  const muestra = 256;
  const k = Math.min(muestra / w, muestra / h, 1);
  const mw = Math.max(1, Math.round(w * k));
  const mh = Math.max(1, Math.round(h * k));
  const { ctx } = lienzo(mw, mh);
  ctx.drawImage(img, 0, 0, mw, mh);
  let datos: Uint8ClampedArray;
  try {
    datos = ctx.getImageData(0, 0, mw, mh).data;
  } catch {
    return null; // lienzo protegido (algunos SVG): se usa la imagen tal cual
  }
  const lum = (i: number) => (0.2126 * datos[i] + 0.7152 * datos[i + 1] + 0.0722 * datos[i + 2]) / 255;
  const esquinaBlanca = datos[3] > 245 && lum(0) > 0.96;

  let x0 = mw, y0 = mh, x1 = -1, y1 = -1, visibles = 0, transparentes = 0, sumaLum = 0;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = (y * mw + x) * 4;
      if (datos[i + 3] < 12) {
        transparentes++;
        continue;
      }
      visibles++;
      sumaLum += lum(i);
      if (esquinaBlanca && lum(i) > 0.96) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0 || !visibles) return null;
  const margen = 1;
  x0 = Math.max(0, x0 - margen);
  y0 = Math.max(0, y0 - margen);
  x1 = Math.min(mw - 1, x1 + margen);
  y1 = Math.min(mh - 1, y1 + margen);
  return {
    x: x0 / k,
    y: y0 / k,
    ancho: (x1 - x0 + 1) / k,
    alto: (y1 - y0 + 1) / k,
    claroSobreTransparente: transparentes / (mw * mh) > 0.05 && sumaLum / visibles > 0.85,
  };
}

/**
 * Prepara el logotipo en el navegador antes de guardarlo: quita los márgenes vacíos para que llene su círculo,
 * le pone fondo oscuro si es claro sobre transparente (si no, desaparece sobre blanco) y lo deja en un cuadrado
 * PNG de hasta `size` px: el formato que aceptan el icono de la app (next/og) y Google Wallet.
 */
export async function prepareLogo(file: File, size: number): Promise<Blob> {
  comprobar(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await cargar(url);
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;
    const a = analizar(img, w, h) ?? { x: 0, y: 0, ancho: w, alto: h, claroSobreTransparente: false };
    const lado = Math.round(Math.min(size, Math.max(a.ancho, a.alto)));
    const k = lado / Math.max(a.ancho, a.alto);
    const dw = a.ancho * k;
    const dh = a.alto * k;
    const { canvas, ctx } = lienzo(lado, lado);
    if (a.claroSobreTransparente) {
      ctx.fillStyle = FONDO_LOGO_CLARO;
      ctx.fillRect(0, 0, lado, lado);
    }
    ctx.drawImage(img, a.x, a.y, a.ancho, a.alto, (lado - dw) / 2, (lado - dh) / 2, dw, dh);
    return await aBlob(canvas, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reduce la foto de fondo a un JPEG liviano: lado mayor de hasta `maximo` px y por debajo del límite de Storage. */
export async function prepareCover(file: File, maximo = 1400): Promise<Blob> {
  comprobar(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await cargar(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const k = Math.min(maximo / Math.max(w, h), 1);
    const { canvas, ctx } = lienzo(Math.round(w * k), Math.round(h * k));
    ctx.fillStyle = "#ffffff"; // JPEG no tiene transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const calidad of [0.82, 0.7, 0.55]) {
      const blob = await aBlob(canvas, "image/jpeg", calidad);
      if (blob.size <= MAX_SALIDA_BYTES) return blob;
    }
    throw new Error("La foto es demasiado pesada. Prueba con otra.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
