import { EMPRESA_PAGINAS } from "./empresa";
import { GUIAS } from "./guias";
import { LEGAL } from "./legal";
import { SECTORES } from "./sectores";
import type { Pagina } from "./tipos";

/** Todas las páginas públicas de contenido, en el orden en que aparecen en el pie. */
export const PAGINAS: Pagina[] = [...GUIAS, ...SECTORES, ...EMPRESA_PAGINAS, ...LEGAL];

export function buscarPagina(ruta: string) {
  return PAGINAS.find((p) => p.ruta === ruta);
}

export type { Pagina } from "./tipos";
