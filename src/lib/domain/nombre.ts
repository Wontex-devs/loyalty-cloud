/**
 * Nombre para saludar a una persona del panel.
 * Las cuentas invitadas sin nombre guardan el correo como nombre: en ese caso no se usa
 * (un correo largo se ve mal y parte el título en el celular).
 */
export function nombreParaSaludo(fullName: string | null | undefined): string | null {
  const limpio = (fullName ?? "").trim();
  if (!limpio || limpio.includes("@")) return null;
  const primero = limpio.split(/\s+/)[0];
  return primero.length >= 2 ? primero : null;
}

/** ¿La cuenta todavía no tiene un nombre real (vacío o el correo)? */
export function faltaNombre(fullName: string | null | undefined): boolean {
  const limpio = (fullName ?? "").trim();
  return !limpio || limpio.includes("@");
}
