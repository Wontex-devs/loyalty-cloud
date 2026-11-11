import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/** Fecha del último cambio de contenido de la portada. Actualícela solo cuando cambie el texto. */
const PORTADA_ACTUALIZADA = "2026-11-11";

/** Por ahora solo la página de venta es pública; el resto del sitio (paneles y tarjetas) no se indexa. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, lastModified: PORTADA_ACTUALIZADA }];
}
