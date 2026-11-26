/**
 * «El hilo»: la composición de los sellos en la franja de la tarjeta.
 * Los sellos van en una hilera (o en dos, si son muchos) enhebrados por un hilo fino; al final,
 * a la derecha, el premio grande, con un aro alrededor, y el hilo se curva hasta abrazarlo (el lazo).
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
  /** Trazos del hilo (atributo `d` de un <path> de SVG): uno por hilera. */
  hilos: string[];
  /** Radio del aro alrededor del premio. */
  aro: number;
  /** Grosor recomendado del hilo y de los bordes. */
  trazo: number;
  /**
   * Dónde va el texto del premio (en puntos de una franja de 144 de alto). Con dos hileras de
   * sellos el texto sube y se achica para dejarles espacio.
   */
  texto: TextoPremio;
}

export interface TextoPremio {
  /** Arriba de «PRÓXIMA RECOMPENSA». */
  etiqueta: number;
  /** Arriba del nombre del premio. */
  nombre: number;
  compacto: boolean;
}

const TEXTO_NORMAL: TextoPremio = { etiqueta: 16, nombre: 33, compacto: false };
const TEXTO_COMPACTO: TextoPremio = { etiqueta: 11, nombre: 25, compacto: true };

/**
 * Dónde va la ilustración del comercio en la franja de 375 × 144 (en lugar de la inicial de fondo):
 * arriba a la derecha, encima del premio, sin tocar los sellos. Se ve tenue para no
 * competir con el premio ni con los sellos.
 */
export const ILUSTRACION = { x: 262, y: 2, ancho: 106, alto: 52, opacidad: 0.4 } as const;

/**
 * El logo de Lazo, pequeño y tenue, en la esquina de arriba a la derecha de la franja (375 × 144):
 * `derecha` es la distancia al borde derecho (así queda en la esquina también en la franja de Google,
 * que es más ancha), `alto` es el tamaño de la letra. Va en todas las tarjetas: web, Apple y Google.
 */
export const MARCA_LAZO = { derecha: 12, y: 8, alto: 10, ancho: 30, opacidad: 0.42 } as const;

/** Con más sellos que estos (contando el premio), van en dos hileras para que no queden diminutos. */
export const HILO_MAX_UNA_FILA = 7;

const n1 = (v: number) => Math.round(v * 10) / 10;

export function hilo(required: number, width: number, height: number): Hilo {
  const total = Math.max(2, Math.floor(required));
  const k = height / 144;
  const ancho = width / k; // todo se calcula en puntos de una franja de 144 de alto
  const n = total - 1; // sellos antes del premio
  const dosFilas = total > HILO_MAX_UNA_FILA;
  // Con dos hileras el texto del premio sube (TEXTO_COMPACTO) y las hileras se reparten el resto.
  const ys = dosFilas ? [74, 117] : [104];
  // El premio, grande, a la derecha; con dos hileras queda entre las dos.
  const R = 27;
  const cx = ancho - 55;
  const cy = dosFilas ? (ys[0] + ys[1]) / 2 : 104;
  const porFila = Math.ceil(n / ys.length);
  const izq = dosFilas ? 20 : 24;
  const der = cx - R - (dosFilas ? 22 : 26);
  const paso = (der - izq) / Math.max(porFila - 1, 1);
  const r = Math.min(dosFilas ? 18 : 19, paso * 0.45);

  const sellos: HiloSello[] = [];
  const hilos: string[] = [];
  let index = 0;
  ys.forEach((y, f) => {
    // Las dos hileras usan el mismo paso: los sellos quedan en columnas.
    const cuantos = f === 0 ? porFila : n - porFila;
    for (let i = 0; i < cuantos; i++) sellos.push({ index: index++, x: n1((izq + i * paso) * k), y: n1(y * k), r: n1(r * k), premio: false });
    // El hilo entra por el borde izquierdo, enhebra la hilera y se curva hacia el premio.
    const fin = cy + (y - cy) * 0.35;
    hilos.push(`M0 ${n1(y * k)} L${n1(der * k)} ${n1(y * k)} Q${n1((cx - R - 6) * k)} ${n1(y * k)} ${n1((cx - R - 4) * k)} ${n1(fin * k)}`);
  });
  sellos.push({ index, x: n1(cx * k), y: n1(cy * k), r: n1(R * k), premio: true });
  return { sellos, hilos, aro: n1((R + 5) * k), trazo: Math.max(1, n1(k)), texto: dosFilas ? TEXTO_COMPACTO : TEXTO_NORMAL };
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
export function ajustePremio(nombre: string, upper = false, compacto = false): AjustePremio {
  const text = nombre.trim().replace(/\s+/g, " ");
  const ancho = 335; // 375 menos los márgenes
  // Ancho medio de una letra respecto a su tamaño (las mayúsculas espaciadas ocupan más).
  const porLetra = upper ? 0.74 : 0.54;
  const unaLinea = Math.floor(ancho / (Math.max(text.length, 1) * porLetra));
  // Con dos hileras de sellos el nombre va más pequeño para dejarles espacio.
  if (unaLinea >= (compacto ? 13 : 16)) return { size: Math.min(compacto ? 18 : 24, unaLinea), lines: 1, text };
  const size = compacto ? 11 : 13;
  const caben = Math.floor(ancho / (size * porLetra)) * 2 - 2;
  return { size, lines: 2, text: text.length > caben ? `${text.slice(0, caben - 1).trimEnd()}…` : text };
}
