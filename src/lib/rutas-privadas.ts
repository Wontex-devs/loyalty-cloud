/**
 * Secciones privadas del sitio: paneles, tarjetas (llevan un token privado), inscripciones y API.
 * Nunca se indexan (cabecera X-Robots-Tag en next.config.ts) ni se rastrean (robots.ts).
 * Todo lo demás es público: la portada, el ícono, los logos, el sitemap, llms.txt y la imagen para compartir.
 */
export const RUTAS_PRIVADAS = ["login", "join", "card", "tap", "business", "admin", "account", "start", "auth", "api"];
