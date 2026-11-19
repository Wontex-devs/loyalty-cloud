import "server-only";

/**
 * Límite de peticiones en memoria por clave (p. ej. IP). Suficiente para el piloto
 * con un solo servidor; en despliegues con varias instancias debe pasar a un
 * almacén compartido (Upstash/Redis o una tabla en Postgres).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  // Limpieza de vez en cuando: sin ella el mapa crece con cada IP nueva.
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}
