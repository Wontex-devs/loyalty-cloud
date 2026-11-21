/**
 * A dónde ir después de iniciar sesión (parámetro `next`). Solo se acepta una ruta de este mismo sitio.
 *
 * No basta con mirar que empiece por «/» y no por «//»: los navegadores tratan «\» como «/» y se saltan
 * tabuladores y saltos de línea, así que «/\/otro-sitio.com» o «/<tab>/otro-sitio.com» terminan en OTRO
 * sitio. Con eso se podía armar un enlace de Lazo que, tras entrar con la contraseña real, llevara a una
 * página falsa que la pidiera de nuevo (phishing). Aquí se comprueba como lo haría el navegador.
 */
const BASE = "https://interno.invalid";

export function rutaInterna(valor: string | null | undefined, porDefecto = "/start"): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 512) return porDefecto;
  // Solo caracteres imprimibles, sin «\» ni espacios raros.
  if (!valor.startsWith("/") || /[\\\u0000-\u001f\u007f\s]/.test(valor)) return porDefecto;
  try {
    const url = new URL(valor, BASE);
    if (url.origin !== BASE) return porDefecto;
    return url.pathname + url.search + url.hash;
  } catch {
    return porDefecto;
  }
}
