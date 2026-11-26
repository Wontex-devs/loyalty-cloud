// Las fechas se escriben en hora de Colombia, igual en el servidor (UTC) que en el navegador:
// si no, React rechaza la página al cargarla (error #418).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dailySeries, diaColombia, formatDate, ultimosMeses } from "../src/lib/utils.ts";

// 10 p. m. del 25 de noviembre en Colombia = 3 a. m. del 26 en UTC.
const NOCHE = "2026-11-26T03:00:00Z";

test("una fecha de la noche se escribe con el día de Colombia, no el de UTC", () => {
  assert.match(formatDate(NOCHE), /^25 (de )?nov/);
});

test("la serie diaria cuenta la visita de la noche en el día de Colombia", () => {
  const s = dailySeries([NOCHE, "2026-11-25T15:00:00Z"], 3, new Date(NOCHE));
  assert.equal(s.length, 3);
  assert.match(s[2].label, /^25 (de )?nov/);
  assert.equal(s[2].value, 2);
  assert.equal(s[0].value + s[1].value, 0);
});

test("el día de Colombia cambia a medianoche de Colombia (5 a. m. UTC)", () => {
  assert.equal(diaColombia("2026-11-26T04:59:00Z"), diaColombia("2026-11-25T05:00:00Z"));
  assert.equal(diaColombia("2026-11-26T05:00:00Z"), diaColombia("2026-11-25T05:00:00Z") + 1);
});

test("los últimos meses terminan en el mes de Colombia", () => {
  // 1 de diciembre a las 2 a. m. UTC: en Colombia todavía es 30 de noviembre.
  const m = ultimosMeses(6, new Date("2026-12-01T02:00:00Z"));
  assert.equal(m.length, 6);
  assert.equal(m[5].clave, "2026-11");
  assert.equal(m[0].clave, "2026-06");
  assert.equal(m[0].clave < m[5].clave, true);
});
