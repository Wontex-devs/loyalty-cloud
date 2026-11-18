// Pruebas de «el hilo»: la composición de sellos que comparten la tarjeta web y el pase de Wallet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustePremio, hilo, HILO_MAX_UNA_FILA, numeroMiembro } from "../src/lib/domain/hilo.ts";
import { memberSinceText } from "../src/lib/wallet/pass.ts";

const W = 375;
const H = 144;

test("todos los sellos caben en la franja, sin tocarse, para 2 a 30 sellos", () => {
  for (let n = 2; n <= 30; n++) {
    const h = hilo(n, W, H);
    assert.equal(h.sellos.length, n, `${n} sellos`);
    assert.equal(h.sellos.filter((s) => s.premio).length, 1);
    assert.equal(h.sellos.at(-1)?.premio, true, "el premio es el último");
    for (const s of h.sellos) {
      const borde = s.premio ? h.aro : s.r;
      assert.ok(s.x - borde >= 0 && s.x + borde <= W, `${n}: el sello ${s.index} se sale a lo ancho`);
      // Bajo el texto del premio (que termina hacia y = 62) y dentro de la franja.
      assert.ok(s.y - borde >= 62 && s.y + borde <= H, `${n}: el sello ${s.index} se sale a lo alto (${s.y}, ${borde})`);
      assert.ok(s.r >= 5, `${n}: sello demasiado pequeño (${s.r})`);
    }
    for (let i = 0; i < h.sellos.length; i++) {
      for (let j = i + 1; j < h.sellos.length; j++) {
        const a = h.sellos[i];
        const b = h.sellos[j];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r, `${n}: los sellos ${i} y ${j} se montan`);
      }
    }
  }
});

test("hasta 12 sellos van en una fila; con más, en dos", () => {
  assert.equal(hilo(HILO_MAX_UNA_FILA, W, H).hilos.length, 1);
  assert.equal(hilo(HILO_MAX_UNA_FILA + 1, W, H).hilos.length, 2);
  assert.equal(new Set(hilo(30, W, H).sellos.map((s) => Math.round(s.y / 20))).size >= 2, true);
});

test("la misma composición a otra escala (imagen de Google Wallet)", () => {
  const a = hilo(8, W, H);
  const b = hilo(8, W * 3, H * 3);
  assert.ok(Math.abs(b.sellos[3].x - a.sellos[3].x * 3) < 0.5);
  assert.ok(Math.abs(b.sellos[3].r - a.sellos[3].r * 3) < 0.5);
  assert.ok(hilo(8, 1032, 336).sellos.every((s) => s.x + s.r <= 1032));
});

test("el nombre del premio va grande si es corto y en dos líneas si es largo", () => {
  assert.deepEqual(ajustePremio("  Café   gratis "), { size: 24, lines: 1, text: "Café gratis" });
  const largo = ajustePremio("Un tratamiento capilar completo con masaje", true);
  assert.equal(largo.lines, 2);
  assert.equal(largo.text, "Un tratamiento capilar completo con masaje");
  // Dos líneas de letra 13 terminan antes de donde empiezan los sellos (y = 62 es el límite que se prueba arriba).
  assert.ok(33 + largo.size * 1.15 * 2 <= 64);
  const enorme = ajustePremio("x".repeat(300));
  assert.equal(enorme.lines, 2);
  assert.ok(enorme.text.endsWith("…") && enorme.text.length < 120);
  assert.ok(ajustePremio("Manicura de cortesía", true).size <= ajustePremio("Manicura de cortesía").size);
});

test("el número de miembro es estable y no deja ver el token", () => {
  const token = "q7Lm2Xv9RkTz4pWb8Nc-_a";
  assert.match(numeroMiembro(token), /^[0-9A-Z]{4} [0-9A-Z]{4}$/);
  assert.equal(numeroMiembro(token), numeroMiembro(token));
  assert.notEqual(numeroMiembro(token), numeroMiembro("otra-tarjeta-distinta-01"));
});

test("«desde» en mes y año", () => {
  assert.equal(memberSinceText("2026-07-01T00:00:00Z"), "Jul 2026");
  assert.equal(memberSinceText("2026-12-31"), "Dic 2026");
  assert.equal(memberSinceText(""), "");
  assert.equal(memberSinceText("sin fecha"), "");
});
