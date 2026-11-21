import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

/**
 * Dibujar cada imagen de un pase (icono, logo, franja de sellos) cuesta: hay que traer el logo y la
 * ilustración y pintar el PNG. Pero la imagen solo depende del diseño del comercio y de cuántos
 * sellos hay, así que muchas tarjetas comparten exactamente la misma. Se dibuja una vez y se guarda:
 *  1. en la memoria de este servidor (instantáneo), y
 *  2. en la caché de datos de Next (sobrevive a los reinicios del servidor y a las publicaciones).
 * La clave incluye todo lo que cambia el dibujo (colores, letra, direcciones de las imágenes —que
 * cambian cada vez que se sube una nueva—, sellos y tamaño): si algo cambia, se dibuja de nuevo.
 */
const memoria = new Map<string, Promise<Buffer>>();
const MAX_EN_MEMORIA = 200;
const UN_MES = 60 * 60 * 24 * 30;
/** Sube este número si cambia el dibujo de las imágenes en el código: descarta todo lo guardado. */
const VERSION_DIBUJO = 1;

export function claveImagen(partes: unknown): string {
  return createHash("sha256").update(JSON.stringify([VERSION_DIBUJO, partes])).digest("base64url").slice(0, 40);
}

export function imagenEnCache(partes: unknown, dibujar: () => Promise<Buffer>): Promise<Buffer> {
  const clave = claveImagen(partes);
  const guardada = memoria.get(clave);
  if (guardada) return guardada;

  const promesa = (async () => {
    try {
      const b64 = await unstable_cache(async () => (await dibujar()).toString("base64"), ["pase-imagen", clave], { revalidate: UN_MES })();
      return Buffer.from(b64, "base64");
    } catch {
      // Sin caché de datos (p. ej. fuera de una petición): se dibuja directo.
      return dibujar();
    }
  })();
  promesa.catch(() => memoria.delete(clave));
  if (memoria.size >= MAX_EN_MEMORIA) memoria.delete(memoria.keys().next().value as string);
  memoria.set(clave, promesa);
  return promesa;
}
