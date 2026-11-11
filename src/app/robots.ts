import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * Las tarjetas llevan un token privado en la URL y los paneles no son públicos.
 * Solo la página de venta ("/" exacta) se puede indexar. Google sí puede descargar
 * los estilos, el código, el ícono, los logos y la imagen para compartir, que necesita
 * para ver la página como la ve una persona.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/_next/static/", "/icon.svg", "/logos/", "/opengraph-image"],
      disallow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
