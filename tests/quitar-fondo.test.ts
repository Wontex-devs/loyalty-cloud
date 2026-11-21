import { test } from "node:test";
import assert from "node:assert/strict";
import { cajaVisible, quitarFondo } from "../src/lib/domain/quitar-fondo.ts";

/** Imagen de prueba: fondo de un color y un dibujo encima (función que decide el color de cada píxel). */
function imagen(ancho: number, alto: number, pixel: (x: number, y: number) => [number, number, number, number?]) {
  const d = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const [r, g, b, a = 255] = pixel(x, y);
      d.set([r, g, b, a], (y * ancho + x) * 4);
    }
  }
  return d;
}
const alfa = (d: Uint8ClampedArray, ancho: number, x: number, y: number) => d[(y * ancho + x) * 4 + 3];

// Un aro marrón sobre blanco, con blanco encerrado en el centro (como el blanco de un ojo).
const aro = (x: number, y: number): [number, number, number] => {
  const r = Math.hypot(x - 20, y - 20);
  return r >= 8 && r <= 14 ? [92, 44, 22] : [255, 255, 255];
};

test("quita el fondo blanco conectado con el borde y deja el dibujo", () => {
  const d = imagen(40, 40, aro);
  assert.equal(quitarFondo(d, 40, 40), "quitado");
  assert.equal(alfa(d, 40, 0, 0), 0); // esquina: fondo
  assert.equal(alfa(d, 40, 20, 2), 0); // fuera del aro: fondo
  assert.equal(alfa(d, 40, 20, 9), 255); // el aro se conserva
});

test("el blanco encerrado dentro del dibujo no se borra", () => {
  const d = imagen(40, 40, aro);
  quitarFondo(d, 40, 40);
  assert.equal(alfa(d, 40, 20, 20), 255); // centro del aro
});

test("aguanta un fondo casi blanco con ruido (como el de un JPG)", () => {
  const d = imagen(40, 40, (x, y) => {
    const [r, g, b] = aro(x, y);
    const ruido = r === 255 ? -((x * 7 + y * 13) % 12) : 0;
    return [r + ruido, g + ruido, b + ruido];
  });
  assert.equal(quitarFondo(d, 40, 40), "quitado");
  assert.equal(alfa(d, 40, 3, 3), 0);
  assert.equal(alfa(d, 40, 20, 9), 255);
});

test("funciona con un fondo de color, no solo blanco", () => {
  const d = imagen(40, 40, (x, y) => (aro(x, y)[0] === 255 ? [244, 238, 224] : [92, 44, 22]));
  assert.equal(quitarFondo(d, 40, 40), "quitado");
  assert.equal(alfa(d, 40, 1, 38), 0);
});

test("si la imagen ya es transparente, no la toca", () => {
  const d = imagen(40, 40, (x, y) => (aro(x, y)[0] === 255 ? [0, 0, 0, 0] : [92, 44, 22, 255]));
  const antes = d.slice();
  assert.equal(quitarFondo(d, 40, 40), "ya-transparente");
  assert.deepEqual(d, antes);
});

test("una foto sin fondo liso no se toca", () => {
  const d = imagen(40, 40, (x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 29) % 256]);
  const antes = d.slice();
  assert.equal(quitarFondo(d, 40, 40), "fondo-no-liso");
  assert.deepEqual(d, antes);
});

test("una imagen de un solo color no se borra entera", () => {
  const d = imagen(20, 20, () => [255, 255, 255]);
  assert.equal(quitarFondo(d, 20, 20), "fondo-no-liso");
  assert.equal(alfa(d, 20, 10, 10), 255);
});

test("el contorno queda suavizado, no con filo duro", () => {
  // Un disco oscuro con el borde difuminado hacia el fondo blanco.
  const d = imagen(40, 40, (x, y) => {
    const t = Math.min(1, Math.max(0, (Math.hypot(x - 20, y - 20) - 8) / 8)); // 0 = dibujo, 1 = fondo
    const v = Math.round(40 + t * 215);
    return [v, v, v];
  });
  assert.equal(quitarFondo(d, 40, 40), "quitado");
  const fila = Array.from({ length: 40 }, (_, x) => alfa(d, 40, x, 20));
  assert.ok(fila.some((a) => a > 0 && a < 255), "debe haber píxeles medio transparentes en el contorno");
  assert.equal(fila[20], 255);
  assert.equal(fila[1], 0);
});

test("la caja visible recorta los márgenes vacíos", () => {
  const d = imagen(40, 40, aro);
  quitarFondo(d, 40, 40);
  assert.deepEqual(cajaVisible(d, 40, 40), { x: 6, y: 6, ancho: 29, alto: 29 });
  assert.equal(cajaVisible(new Uint8ClampedArray(16), 2, 2), null);
});
