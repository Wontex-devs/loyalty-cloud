import { test } from "node:test";
import assert from "node:assert/strict";
import { diasHasta, estadoCobro, fechaCorta, hoyColombia, sumarMeses, textoVencimiento } from "../src/lib/domain/cobros.ts";

test("estado del cobro según la fecha «pagado hasta»", () => {
  const hoy = "2026-11-19";
  assert.equal(estadoCobro("2026-12-31", hoy), "al-dia");
  assert.equal(estadoCobro("2026-11-24", hoy), "por-vencer"); // 5 días
  assert.equal(estadoCobro("2026-11-19", hoy), "por-vencer"); // vence hoy: todavía no está vencido
  assert.equal(estadoCobro("2026-11-18", hoy), "vencido");
  assert.equal(estadoCobro(null, hoy), "sin-dato");
  assert.equal(estadoCobro("19/11/2026", hoy), "sin-dato");
});

test("texto del vencimiento", () => {
  const hoy = "2026-11-19";
  assert.equal(textoVencimiento("2026-11-19", hoy), "Vence hoy");
  assert.equal(textoVencimiento("2026-11-20", hoy), "Vence mañana");
  assert.equal(textoVencimiento("2026-11-22", hoy), "Vence en 3 días");
  assert.equal(textoVencimiento("2026-11-18", hoy), "Venció ayer");
  assert.equal(textoVencimiento("2026-11-09", hoy), "Venció hace 10 días");
});

test("los días se cuentan bien al cambiar de mes y de año", () => {
  assert.equal(diasHasta("2027-01-01", "2026-12-31"), 1);
  assert.equal(diasHasta("2026-03-01", "2026-02-28"), 1);
});

test("sumar meses igual que la base de datos", () => {
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(sumarMeses("2026-02-28", 2), "2026-04-28");
  assert.equal(sumarMeses("2026-11-15", 2), "2027-01-15");
  assert.equal(sumarMeses("2028-01-31", 1), "2028-02-29");
});

test("la fecha se muestra sin correrse un día y hoy es en hora de Colombia", () => {
  assert.match(fechaCorta("2026-03-01"), /^1 (de )?mar/);
  assert.equal(fechaCorta(null), "—");
  // 3 a. m. en UTC del 20 de noviembre todavía es 19 de noviembre en Colombia.
  assert.equal(hoyColombia(new Date("2026-11-20T03:00:00Z")), "2026-11-19");
});
