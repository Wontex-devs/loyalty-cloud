/**
 * Reglas puras para que el celular del cliente «recuerde» su tarjeta y para reconocerlo por sus datos.
 * Sin dependencias de Next ni de la base: se prueban con node --test.
 */

/** Nombre de la cookie que guarda las tarjetas de este celular (una por comercio). */
export const COOKIE_TARJETAS = "lazo_tarjetas";
/** Cuántas tarjetas recuerda como máximo un mismo celular (de comercios distintos). */
export const MAX_TARJETAS_RECORDADAS = 8;
/** Duración de la cookie: 400 días, el máximo que aceptan los navegadores. Cada visita la renueva. */
export const DURACION_COOKIE_SEGUNDOS = 400 * 24 * 60 * 60;

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** Lee la lista de tarjetas de la cookie; ignora lo que no tenga forma de enlace de tarjeta. */
export function leerTarjetas(valor: string | undefined | null): string[] {
  if (!valor) return [];
  const vistas = new Set<string>();
  for (const t of valor.split(".")) if (TOKEN.test(t)) vistas.add(t);
  return [...vistas].slice(0, MAX_TARJETAS_RECORDADAS);
}

/** Pone la tarjeta de primera (la más reciente) y recorta la lista. */
export function agregarTarjeta(lista: string[], token: string): string[] {
  if (!TOKEN.test(token)) return lista.slice(0, MAX_TARJETAS_RECORDADAS);
  return [token, ...lista.filter((t) => t !== token)].slice(0, MAX_TARJETAS_RECORDADAS);
}

export const escribirTarjetas = (lista: string[]) => lista.join(".");

/**
 * ¿La página se abrió dentro de una app (Instagram, Facebook, WhatsApp, TikTok…) en lugar del navegador?
 * Ahí la tarjeta queda guardada en esa app y el toque NFC, que abre Safari o Chrome, no la encuentra.
 */
export function esNavegadorDeApp(userAgent: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp|\bLine\/|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|LinkedInApp|GSA\//i.test(userAgent ?? "");
}
