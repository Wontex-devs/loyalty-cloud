/**
 * «El hilo»: la composición de los sellos en la franja de la tarjeta.
 * Un hilo fino cruza la franja y enhebra los sellos sobre una curva suave; el último es el
 * premio, más grande y con un aro alrededor (el lazo).
 *
 * La usan la tarjeta web y la imagen del pase de Apple y Google Wallet, para que se vean igual.
 * Todo se calcula sobre una franja de `width` × `height`; la de Apple mide 375 × 144 puntos.
 */

export interface HiloSello {
  /** Posición del sello, empezando en 0. */
  index: number;
  /** Centro y radio, en las mismas unidades que `width` y `height`. */
  x: number;
  y: number;
  r: number;
  /** El último sello es el premio. */
  premio: boolean;
}

export interface Hilo {
  sellos: HiloSello[];
  /** Trazos del hilo (atributo `d` de un <path> de SVG): uno por fila. */
  hilos: string[];
  /** Radio del aro alrededor del premio. */
  aro: number;
  /** Grosor recomendado del hilo y de los bordes. */
  trazo: number;
}

/** Con más sellos que estos, van en dos filas para que no queden diminutos. */
export const HILO_MAX_UNA_FILA = 12;

const n1 = (v: number) => Math.round(v * 10) / 10;

export function hilo(required: number, width: number, height: number): Hilo {
  const total = Math.max(2, Math.floor(required));
  const k = height / 144;
  const izquierda = 34 * k;
  const derecha = width - 37 * k;
  const dosFilas = total > HILO_MAX_UNA_FILA;
  const filas = dosFilas ? [Math.ceil(total / 2), Math.floor(total / 2)] : [total];
  const bases = dosFilas ? [88 * k, 122 * k] : [106 * k];
  const amplitud = (dosFilas ? 4 : 11) * k;
  // La curva sube un poco en el centro de la franja.
  const curva = (x: number, base: number) => base - amplitud * Math.sin((Math.PI * (x - 10 * k)) / (width - 20 * k));

  const masLarga = Math.max(...filas);
  const paso = (derecha - izquierda) / Math.max(masLarga - 1, 1);
  const r = Math.min((dosFilas ? 9.5 : 13) * k, paso * 0.36);
  const rPremio = r + (dosFilas ? 2 : 3) * k;

  const sellos: HiloSello[] = [];
  const hilos: string[] = [];
  let index = 0;
  filas.forEach((cuantos, fila) => {
    const base = bases[fila];
    const pasoFila = (derecha - izquierda) / Math.max(cuantos - 1, 1);
    for (let i = 0; i < cuantos; i++) {
      const x = cuantos === 1 ? derecha : izquierda + i * pasoFila;
      const premio = index === total - 1;
      sellos.push({ index, x: n1(x), y: n1(curva(x, base)), r: n1(premio ? rPremio : r), premio });
      index++;
    }
    // El hilo entra por el borde izquierdo y llega hasta el último sello de la fila.
    let d = `M0 ${n1(curva(0, base))}`;
    for (let x = 4 * k; x < derecha; x += 4 * k) d += ` L${n1(x)} ${n1(curva(x, base))}`;
    d += ` L${n1(derecha)} ${n1(curva(derecha, base))}`;
    hilos.push(d);
  });

  return { sellos, hilos, aro: n1(rPremio + 4.5 * k), trazo: Math.max(1, n1(k)) };
}

export interface AjustePremio {
  /** Tamaño de letra, en puntos de una franja de 144 de alto. */
  size: number;
  lines: 1 | 2;
  /** El nombre, recortado con «…» si ni en dos líneas cabe. */
  text: string;
}

/**
 * Cómo escribir el nombre del premio para que quepa en la franja: grande en una línea si es
 * corto; si es largo, más pequeño y en dos líneas. Nunca se sale ni tapa los sellos.
 */
export function ajustePremio(nombre: string, upper = false): AjustePremio {
  const text = nombre.trim().replace(/\s+/g, " ");
  const ancho = 335; // 375 menos los márgenes
  // Ancho medio de una letra respecto a su tamaño (las mayúsculas espaciadas ocupan más).
  const porLetra = upper ? 0.74 : 0.54;
  const unaLinea = Math.floor(ancho / (Math.max(text.length, 1) * porLetra));
  if (unaLinea >= 16) return { size: Math.min(24, unaLinea), lines: 1, text };
  const size = 13;
  const caben = Math.floor(ancho / (size * porLetra)) * 2 - 2;
  return { size, lines: 2, text: text.length > caben ? `${text.slice(0, caben - 1).trimEnd()}…` : text };
}

/**
 * Número de miembro que se muestra bajo el código QR: 8 caracteres en dos grupos.
 * Se deriva del token con un resumen simple, así no deja ver parte del enlace secreto.
 */
export function numeroMiembro(token: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < token.length; i++) {
    a = Math.imul(a ^ token.charCodeAt(i), 0x01000193);
    b = Math.imul(b + token.charCodeAt(i), 0x85ebca6b) ^ (b >>> 13);
  }
  const s = ((a >>> 0).toString(36) + (b >>> 0).toString(36)).toUpperCase().padEnd(8, "0").slice(0, 8);
  return `${s.slice(0, 4)} ${s.slice(4)}`;
}
