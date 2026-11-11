import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { RUTAS_PRIVADAS } from "@/lib/rutas-privadas";

/**
 * Lo público (portada, ícono, logos, llms.txt, imagen para compartir y futuras páginas) se puede rastrear.
 * Las secciones privadas no: las tarjetas llevan un token privado y los paneles no son públicos.
 * Además, esas secciones llevan la cabecera noindex (next.config.ts).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: RUTAS_PRIVADAS.map((r) => `/${r}`) },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
