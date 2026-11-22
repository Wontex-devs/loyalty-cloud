/**
 * Control de cobros a los comercios: a partir de la fecha «pagado hasta» (AAAA-MM-DD, hora de Colombia)
 * se calcula si el comercio está al día, por vencer o vencido. Nada se suspende solo.
 */

export type EstadoCobro = "al-dia" | "por-vencer" | "vencido" | "sin-dato";

/** Días antes del vencimiento en que se empieza a avisar. */
export const DIAS_AVISO_COBRO = 5;

export const ESTADOS_COBRO: Record<EstadoCobro, { nombre: string; tono: "success" | "warning" | "danger" | "neutral" }> = {
  "al-dia": { nombre: "Al día", tono: "success" },
  "por-vencer": { nombre: "Por vencer", tono: "warning" },
  vencido: { nombre: "Vencido", tono: "danger" },
  "sin-dato": { nombre: "Sin fecha", tono: "neutral" },
};

const esFecha = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Hoy en Colombia, como AAAA-MM-DD. */
export function hoyColombia(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

const aDias = (f: string) => {
  const [a, m, d] = f.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
};

/** Días que faltan para la fecha (negativo si ya pasó). */
export function diasHasta(fecha: string, hoy = hoyColombia()): number {
  return aDias(fecha) - aDias(hoy);
}

/** Pagado hasta el día X incluido: vencido desde el día siguiente. */
export function estadoCobro(pagadoHasta: string | null | undefined, hoy = hoyColombia()): EstadoCobro {
  if (!esFecha(pagadoHasta)) return "sin-dato";
  const dias = diasHasta(pagadoHasta, hoy);
  if (dias < 0) return "vencido";
  if (dias <= DIAS_AVISO_COBRO) return "por-vencer";
  return "al-dia";
}

/** Frase corta para la tabla: «vence en 3 días», «venció hace 2 días». */
export function textoVencimiento(pagadoHasta: string | null | undefined, hoy = hoyColombia()): string {
  if (!esFecha(pagadoHasta)) return "Sin fecha de pago";
  const dias = diasHasta(pagadoHasta, hoy);
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  if (dias > 1) return `Vence en ${dias} días`;
  if (dias === -1) return "Venció ayer";
  return `Venció hace ${-dias} días`;
}

/** Fecha AAAA-MM-DD como «28 de feb de 2026», sin correrse un día por la zona horaria. */
export function fechaCorta(fecha: string | null | undefined): string {
  if (!esFecha(fecha)) return "—";
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** Igual que la base de datos: sumar meses y, si el día no existe, quedarse en el último del mes (31 ene + 1 = 28 feb). */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/** Orden para «Por cobrar»: primero los más vencidos. */
export function prioridadCobro(pagadoHasta: string | null | undefined, hoy = hoyColombia()): number {
  return esFecha(pagadoHasta) ? diasHasta(pagadoHasta, hoy) : Number.POSITIVE_INFINITY;
}

export interface AvisoCobro {
  tono: "info" | "warning" | "danger";
  titulo: string;
  texto: string;
  /** Clave para «no mostrar más hoy» (cambia cada día y con cada estado). */
  clave: string;
}

/**
 * Aviso de cobro para el panel del dueño (null si está al día).
 *  * Comercio nuevo del Starter que aún no paga: invitación con la promoción (no un «vencido»).
 *  * Por vencer (5 días o menos): aviso amarillo con la fecha.
 *  * Vencido: aviso rojo con los días de atraso.
 */
export function avisoCobro(
  b: { pagadoHasta: string | null | undefined; mesGratisPendiente: boolean; planId: string },
  hoy = hoyColombia(),
): AvisoCobro | null {
  const estado = estadoCobro(b.pagadoHasta, hoy);
  if (estado === "al-dia" || estado === "sin-dato") return null;
  const clave = `${hoy}:${estado}:${b.pagadoHasta}`;
  if (b.mesGratisPendiente && b.planId === "plan_starter") {
    return {
      tono: "info",
      titulo: "Activa tu plan Starter",
      texto: "Paga el primer mes y el segundo es gratis. Tus clientes siguen sumando sellos sin interrupción.",
      clave,
    };
  }
  const fecha = fechaCorta(b.pagadoHasta);
  if (estado === "por-vencer") {
    const cuando = textoVencimiento(b.pagadoHasta, hoy).replace(/^Vence /, "");
    return {
      tono: "warning",
      titulo: `Tu plan vence ${cuando === "hoy" || cuando === "mañana" ? cuando : `el ${fecha}`}`,
      texto: `Está pagado hasta el ${fecha}. Págalo a tiempo para que tus clientes sigan sumando sellos sin interrupción.`,
      clave,
    };
  }
  return {
    tono: "danger",
    titulo: `Tu plan venció ${textoVencimiento(b.pagadoHasta, hoy).replace(/^Venció /, "")}`,
    texto: `Estaba pagado hasta el ${fecha}. Ponte al día para seguir usando Lazo con tus clientes.`,
    clave,
  };
}
