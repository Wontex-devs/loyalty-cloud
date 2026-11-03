/**
 * Prepara el logotipo en el navegador antes de guardarlo: lo reduce a un
 * cuadrado de `size` px (sin recortar, con fondo transparente) y lo convierte
 * a PNG: es el formato que aceptan el icono de la app (next/og) y Google Wallet.
 */
export const LOGO_MAX_INPUT_BYTES = 8 * 1024 * 1024;

export async function prepareLogo(file: File, size: number): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp|svg\+xml|gif|avif|heic|heif)$/.test(file.type)) {
    throw new Error("Usa una imagen PNG, JPG, WebP o SVG.");
  }
  if (file.size > LOGO_MAX_INPUT_BYTES) throw new Error("La imagen pesa más de 8 MB.");

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("No se pudo leer la imagen. Prueba con otro archivo.");
    });
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;
    const scale = Math.min(size / w, size / h, 1) || 1;
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);
    const side = Math.max(dw, dh);

    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (side - dw) / 2, (side - dh) / 2, dw, dh);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Tu navegador no pudo procesar la imagen.");
    return blob;
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
