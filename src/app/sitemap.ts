import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/** Solo la página de venta es pública; el resto del sitio (paneles y tarjetas) no se indexa. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 }];
}
