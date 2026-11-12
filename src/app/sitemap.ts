import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { PAGINAS } from "@/lib/contenido";

/** Fecha del último cambio de contenido de la portada. Actualícela solo cuando cambie el texto. */
const PORTADA_ACTUALIZADA = "2026-11-11";

/** Páginas públicas: la portada y las de src/lib/contenido (cada una con su fecha real de actualización). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: PORTADA_ACTUALIZADA },
    ...PAGINAS.map((p) => ({ url: `${SITE_URL}/${p.ruta}`, lastModified: p.actualizado })),
  ];
}
