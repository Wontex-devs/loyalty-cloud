// Pruebas de «el hilo»: la composición de sellos que comparten la tarjeta web y el pase de Wallet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustePremio, anchoTextoPremio, hilo, HILO_MAX_UNA_FILA, ILUSTRACION, MARCA_LAZO } from "../src/lib/domain/hilo.ts";
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
      // Bajo el texto del premio (termina hacia y = 62, o y = 51 cuando va compacto) y dentro de la franja.
      const techo = h.texto.compacto ? 51 : 62;
      assert.ok(s.y - borde >= techo && s.y + borde <= H, `${n}: el sello ${s.index} se sale a lo alto (${s.y}, ${borde})`);
      assert.ok(s.r >= 5, `${n}: sello demasiado pequeño (${s.r})`);
    }
    // El aro del premio no toca ningún sello.
    const premio = h.sellos.at(-1)!;
    for (const s of h.sellos.slice(0, -1)) {
      assert.ok(Math.hypot(s.x - premio.x, s.y - premio.y) > s.r + h.aro, `${n}: el sello ${s.index} toca el aro del premio`);
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

test("hasta 7 sellos van en una hilera; con más, en dos y el texto del premio se compacta", () => {
  assert.equal(hilo(HILO_MAX_UNA_FILA, W, H).hilos.length, 1);
  assert.equal(hilo(HILO_MAX_UNA_FILA + 1, W, H).hilos.length, 2);
  assert.equal(new Set(hilo(30, W, H).sellos.map((s) => Math.round(s.y / 20))).size >= 2, true);
  assert.equal(hilo(HILO_MAX_UNA_FILA, W, H).texto.compacto, false);
  assert.equal(hilo(HILO_MAX_UNA_FILA + 1, W, H).texto.compacto, true);
  // Los sellos siguen siendo grandes (no diminutos) hasta 16.
  for (let n = 2; n <= 16; n++) assert.ok(hilo(n, W, H).sellos[0].r >= 16, `${n}: sellos pequeños`);
});

test("en dos hileras los sellos quedan en columnas y el premio, grande, cierra a la derecha", () => {
  for (const n of [8, 9, 10, 11, 13, 16, 29]) {
    const h = hilo(n, W, H);
    const comunes = h.sellos.filter((s) => !s.premio);
    const arriba = new Set(comunes.filter((s) => s.y < 96).map((s) => s.x));
    const abajo = comunes.filter((s) => s.y >= 96);
    assert.ok(abajo.length > 0, `${n}: no hay segunda hilera`);
    assert.ok(abajo.every((s) => arriba.has(s.x)), `${n}: la fila de abajo no está en columnas`);
    assert.equal(h.sellos.at(-1)?.x, Math.max(...h.sellos.map((s) => s.x)), `${n}: el premio no cierra la franja`);
    assert.ok(h.sellos.at(-1)!.r > comunes[0].r, `${n}: el premio no es el más grande`);
  }
});

test("el logo de Lazo (abajo a la derecha) no toca ningún sello ni el aro del premio", () => {
  // Caja del logo: la letra y el aro, de `alto` de alto.
  const izq = W - MARCA_LAZO.derecha - MARCA_LAZO.ancho;
  const der = W - MARCA_LAZO.derecha;
  const arriba = MARCA_LAZO.y;
  const abajo = MARCA_LAZO.y + MARCA_LAZO.alto;
  assert.ok(abajo <= H - 2, "el logo se sale por abajo");
  for (let n = 2; n <= 30; n++) {
    const h = hilo(n, W, H);
    for (const s of h.sellos) {
      const borde = s.premio ? h.aro + h.trazo : s.r;
      // Distancia del centro del círculo al rectángulo del logo.
      const dx = Math.max(izq - s.x, 0, s.x - der);
      const dy = Math.max(arriba - s.y, 0, s.y - abajo);
      assert.ok(Math.hypot(dx, dy) > borde, `${n}: el sello ${s.index} toca el logo`);
    }
  }
});

test("con ilustración, el nombre del premio no pasa por debajo de ella", () => {
  assert.equal(anchoTextoPremio(W, false), 335);
  assert.ok(20 + anchoTextoPremio(W, true) <= ILUSTRACION.x - 8);
  // En la franja de Google (más ancha), la ilustración va pegada a la derecha y el texto también le deja espacio.
  const anchoGoogle = 1032 / (336 / 144);
  assert.ok(20 + anchoTextoPremio(anchoGoogle, true) <= anchoGoogle - (375 - ILUSTRACION.x) - 8);
  // Un nombre largo se achica o pasa a dos líneas para caber en ese espacio.
  const largo = ajustePremio("Tratamiento capilar completo", true, false, anchoTextoPremio(W, true));
  assert.ok(largo.lines === 2 || largo.size * largo.text.length * 0.74 <= anchoTextoPremio(W, true));
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
  // Compacto (dos hileras): termina antes de y = 51.
  const corto = ajustePremio("Café gratis", false, true);
  assert.ok(25 + corto.size * 1.15 <= 51);
  const largoC = ajustePremio("Un tratamiento capilar completo con masaje", true, true);
  assert.ok(25 + largoC.size * 1.15 * largoC.lines <= 51);
  const enorme = ajustePremio("x".repeat(300));
  assert.equal(enorme.lines, 2);
  assert.ok(enorme.text.endsWith("…") && enorme.text.length < 120);
  assert.ok(ajustePremio("Manicura de cortesía", true).size <= ajustePremio("Manicura de cortesía").size);
});

test("«desde» en mes y año", () => {
  assert.equal(memberSinceText("2026-07-01T00:00:00Z"), "Jul 2026");
  assert.equal(memberSinceText("2026-12-31"), "Dic 2026");
  assert.equal(memberSinceText(""), "");
  assert.equal(memberSinceText("sin fecha"), "");
});
