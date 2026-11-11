/** Lectura del lector NFC del mostrador (Smart Tap de Google Wallet o un lector de QR en modo teclado). */

/**
 * El lector escribe lo que leyó y pulsa Enter. Puede ser:
 * - el token de la tarjeta (valor de Smart Tap de Google Wallet);
 * - el ID del pase de Google (emisor.card-<token>), si el pase aún no tiene ese valor;
 * - la URL /card/<token> (un lector de QR en modo teclado).
 */
export function parseToken(raw: string) {
  const v = raw.trim();
  const m = v.match(/(?:\/card\/|\.card-)([A-Za-z0-9_-]{16,64})/);
  return m ? m[1] : /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}
