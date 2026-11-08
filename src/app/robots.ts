import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Las tarjetas llevan un token privado en la URL y los paneles no son públicos.
 * Solo la página de venta del sitio real ("/" exacta) se puede indexar.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isSupabaseConfigured) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/$", disallow: "/" } };
}
