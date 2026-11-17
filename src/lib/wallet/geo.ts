/**
 * Ubicación de las sedes para el aviso de cercanía de las billeteras.
 * Apple y Google admiten como máximo 10 ubicaciones por pase o programa.
 */

export interface Place {
  latitude: number;
  longitude: number;
}

export const MAX_PLACES = 10;

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Coordenadas a partir de lo que pegue el comercio: «4.6987, -74.0412» o un enlace
 * completo de Google Maps (…/@4.69,-74.04,17z, …!3d4.69!4d-74.04, …?q=4.69,-74.04).
 * null si no se reconocen (p. ej. un enlace corto maps.app.goo.gl).
 */
export function parseCoordinates(input: string): Place | null {
  const s = input.trim();
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`), // el punto exacto del lugar
    new RegExp(String.raw`[?&](?:q|query|ll|destination)=${num}(?:,|%2C)\s*${num}`, "i"),
    new RegExp(String.raw`@${num},${num}`), // el centro del mapa
    new RegExp(String.raw`^${num}\s*[,;\s]\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { latitude: round(lat), longitude: round(lng) };
    }
  }
  return null;
}

/** Sedes activas con ubicación, sin repetir y como máximo 10. */
export function placesFrom(rows: { latitude?: number | null; longitude?: number | null; active?: boolean }[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const r of rows) {
    if (r.active === false || r.latitude == null || r.longitude == null || !valid(r.latitude, r.longitude)) continue;
    const key = `${r.latitude},${r.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ latitude: r.latitude, longitude: r.longitude });
    if (out.length === MAX_PLACES) break;
  }
  return out;
}
