/**
 * Quita el fondo liso de una imagen (blanco, crema, un color plano…) y lo deja transparente.
 * Trabaja sobre los píxeles RGBA de un lienzo, en el navegador: la imagen no sale del computador.
 *
 * Cómo: toma el color del borde como «fondo» y, desde las orillas hacia adentro, borra todo lo que se
 * le parezca y esté conectado con el borde. Lo que queda encerrado dentro del dibujo NO se toca
 * (el blanco de los ojos, un pelaje claro), y el contorno se suaviza para que no quede un filo duro.
 *
 * No sirve para fotos con fondos de muchos colores (una calle, una mesa): en ese caso avisa y no cambia nada.
 */
export type ResultadoFondo = "quitado" | "ya-transparente" | "fondo-no-liso";

/** Qué tan parecido al color del borde debe ser un píxel para contarlo como fondo (0–255 por canal). */
export const TOLERANCIA_FONDO = 38;

export function quitarFondo(datos: Uint8ClampedArray, ancho: number, alto: number, tolerancia = TOLERANCIA_FONDO): ResultadoFondo {
  const total = ancho * alto;
  if (total === 0 || datos.length < total * 4) return "fondo-no-liso";

  // 1. Si ya trae transparencia, se respeta tal cual.
  let transparentes = 0;
  for (let i = 3; i < total * 4; i += 4) if (datos[i] < 250) transparentes++;
  if (transparentes / total > 0.03) return "ya-transparente";

  // 2. Color del fondo: la mediana de los píxeles del borde (aguanta que el dibujo toque una orilla).
  const borde: number[] = [];
  for (let x = 0; x < ancho; x++) borde.push(x, (alto - 1) * ancho + x);
  for (let y = 1; y < alto - 1; y++) borde.push(y * ancho, y * ancho + ancho - 1);
  const mediana = (canal: number) => {
    const v = borde.map((p) => datos[p * 4 + canal]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const fr = mediana(0);
  const fg = mediana(1);
  const fb = mediana(2);
  const distancia = (p: number) => {
    const i = p * 4;
    return Math.max(Math.abs(datos[i] - fr), Math.abs(datos[i + 1] - fg), Math.abs(datos[i + 2] - fb));
  };

  // Si el borde no es de un color parejo, no hay un fondo liso que quitar.
  let parejos = 0;
  for (const p of borde) if (distancia(p) <= tolerancia) parejos++;
  if (parejos / borde.length < 0.6) return "fondo-no-liso";

  // 3. Desde las orillas hacia adentro: todo lo parecido al fondo y conectado con el borde.
  const esFondo = new Uint8Array(total);
  const pila = new Int32Array(total);
  let n = 0;
  for (const p of borde) {
    if (!esFondo[p] && distancia(p) <= tolerancia) {
      esFondo[p] = 1;
      pila[n++] = p;
    }
  }
  while (n > 0) {
    const p = pila[--n];
    const x = p % ancho;
    const y = (p - x) / ancho;
    const vecino = (q: number) => {
      if (!esFondo[q] && distancia(q) <= tolerancia) {
        esFondo[q] = 1;
        pila[n++] = q;
      }
    };
    if (x > 0) vecino(p - 1);
    if (x < ancho - 1) vecino(p + 1);
    if (y > 0) vecino(p - ancho);
    if (y < alto - 1) vecino(p + ancho);
  }

  // Si «todo» era fondo (imagen lisa) o casi nada lo era, no se toca.
  let borrados = 0;
  for (let p = 0; p < total; p++) borrados += esFondo[p];
  if (borrados / total > 0.985 || borrados / total < 0.02) return "fondo-no-liso";

  // 4. Se borra el fondo y se suaviza el contorno: los píxeles pegados al fondo quedan medio transparentes
  //    según cuánto se parezcan a él (así no queda un borde blanco ni un filo de sierra).
  const suave = tolerancia * 1.4;
  for (let p = 0; p < total; p++) {
    if (esFondo[p]) {
      datos[p * 4 + 3] = 0;
      continue;
    }
    const x = p % ancho;
    const y = (p - x) / ancho;
    const tocaFondo =
      (x > 0 && esFondo[p - 1]) ||
      (x < ancho - 1 && esFondo[p + 1]) ||
      (y > 0 && esFondo[p - ancho]) ||
      (y < alto - 1 && esFondo[p + ancho]) ||
      (x > 0 && y > 0 && esFondo[p - ancho - 1]) ||
      (x < ancho - 1 && y > 0 && esFondo[p - ancho + 1]) ||
      (x > 0 && y < alto - 1 && esFondo[p + ancho - 1]) ||
      (x < ancho - 1 && y < alto - 1 && esFondo[p + ancho + 1]);
    if (!tocaFondo) continue;
    const d = distancia(p);
    if (d < tolerancia + suave) datos[p * 4 + 3] = Math.round(255 * Math.max(0.15, (d - tolerancia) / suave));
  }
  return "quitado";
}

/** Rectángulo que ocupa lo visible (alfa mayor que el umbral), o null si no hay nada. */
export function cajaVisible(datos: Uint8ClampedArray, ancho: number, alto: number, umbral = 12): { x: number; y: number; ancho: number; alto: number } | null {
  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (datos[(y * ancho + x) * 4 + 3] <= umbral) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 };
}
