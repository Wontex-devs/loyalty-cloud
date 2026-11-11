import type { MetadataRoute } from "next";

/**
 * Las tarjetas llevan un token privado en la URL y los paneles no son públicos.
 * Solo la página de venta ("/" exacta) se puede indexar.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/$", disallow: "/" } };
}
