import type { MetadataRoute } from "next";

/** Las tarjetas llevan un token privado en la URL y los paneles no son públicos: nada se indexa. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
