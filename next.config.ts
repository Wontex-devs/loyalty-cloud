import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las rutas. La cámara solo se permite en el propio
// sitio (escáner de QR); el sitio no se puede incrustar en iframes de terceros.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const noIndexar = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      // Solo la página de venta ("/") y los archivos para buscadores quedan visibles para Google.
      // Paneles, tarjetas (llevan un token privado) e inscripciones nunca se indexan.
      { source: "/:ruta((?!sitemap\\.xml$|robots\\.txt$|opengraph-image).+)", headers: noIndexar },
      // Las vistas previas de Vercel nunca se indexan.
      ...(process.env.VERCEL_ENV === "preview" ? [{ source: "/:path*", headers: noIndexar }] : []),
    ];
  },
};

export default nextConfig;
