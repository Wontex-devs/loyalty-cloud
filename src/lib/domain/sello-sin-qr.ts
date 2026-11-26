/**
 * Sello sin QR: el comercio suma el sello sin leer el código (pedido a domicilio, QR que no se
 * puede escanear…). El motivo es obligatorio; en un domicilio se puede añadir el número de la
 * factura o del pedido. Todo queda en un solo texto, guardado en la visita y en la auditoría.
 */

/** Motivos frecuentes: con un toque se escriben en el campo del motivo (que se puede editar). */
export const MOTIVOS_SIN_QR = [
  "Pedido a domicilio",
  "El QR no se pudo escanear",
  "El cliente no tenía el celular",
  "El toque NFC no funcionó",
] as const;

export const MOTIVO_MIN = 5;
const MOTIVO_MAX = 145; // con « · Factura » y 40 de factura no pasa de 200 (el límite de la base)
const FACTURA_MAX = 40;

/** El motivo habla de un domicilio: se ofrece el campo del número de factura o pedido. */
export const esDomicilio = (motivo: string) => /domicilio|delivery|rappi|didi|ifood|pedido/i.test(motivo);

export type MotivoSinQr = { ok: true; texto: string } | { ok: false; error: string };

/** Arma el texto que se guarda: «Pedido a domicilio · Factura FV-1234». */
export function motivoSinQr(motivo: string, factura = ""): MotivoSinQr {
  const m = motivo.replace(/\s+/g, " ").trim();
  if (m.length < MOTIVO_MIN) return { ok: false, error: `Escribe el motivo (mínimo ${MOTIVO_MIN} letras).` };
  if (m.length > MOTIVO_MAX) return { ok: false, error: `El motivo es muy largo (máximo ${MOTIVO_MAX} letras).` };
  const f = factura.replace(/\s+/g, " ").trim().replace(/^(factura|pedido|n[°º.]?|#)\s*/i, "");
  if (f.length > FACTURA_MAX) return { ok: false, error: `El número de factura es muy largo (máximo ${FACTURA_MAX}).` };
  return { ok: true, texto: f ? `${m} · Factura ${f}` : m };
}

/** Busca clientes por nombre o celular (sin tildes ni espacios). */
export function coincideCliente(busqueda: string, nombre: string, celular?: string | null) {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(busqueda.trim());
  if (!q) return false;
  const digitos = q.replace(/\D/g, "");
  if (digitos.length >= 3 && (celular ?? "").replace(/\D/g, "").includes(digitos)) return true;
  return q.split(/\s+/).every((p) => norm(nombre).includes(p));
}
