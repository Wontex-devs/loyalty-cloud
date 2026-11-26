import { test } from "node:test";
import assert from "node:assert/strict";
import { accesoCortado, avisoCobro, diasHasta, estadoCobro, fechaCorta, hoyColombia, finDeGracia, sumarMeses, textoVencimiento } from "../src/lib/domain/cobros.ts";

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

test("aviso de cobro en el panel del dueño", () => {
  const hoy = "2026-11-22";
  const b = { mesGratisPendiente: false, planId: "plan_pro" };
  assert.equal(avisoCobro({ ...b, pagadoHasta: "2026-12-10" }, hoy), null, "al día: sin aviso");
  assert.equal(avisoCobro({ ...b, pagadoHasta: null }, hoy), null, "sin fecha: sin aviso");

  const pronto = avisoCobro({ ...b, pagadoHasta: "2026-11-25" }, hoy);
  assert.equal(pronto?.tono, "warning");
  assert.match(pronto!.titulo, /^Tu plan vence el 25 de nov/);
  assert.equal(avisoCobro({ ...b, pagadoHasta: "2026-11-22" }, hoy)?.titulo, "Tu plan vence hoy");
  assert.equal(avisoCobro({ ...b, pagadoHasta: "2026-11-23" }, hoy)?.titulo, "Tu plan vence mañana");

  const vencido = avisoCobro({ ...b, pagadoHasta: "2026-11-19" }, hoy);
  assert.equal(vencido?.tono, "danger");
  assert.equal(vencido?.titulo, "Tu plan venció hace 3 días");
  assert.equal(avisoCobro({ ...b, pagadoHasta: "2026-11-21" }, hoy)?.titulo, "Tu plan venció ayer");

  // Comercio nuevo del Starter: invitación con la promoción, no un «vencido».
  const nuevo = avisoCobro({ pagadoHasta: "2026-11-20", mesGratisPendiente: true, planId: "plan_starter" }, hoy);
  assert.equal(nuevo?.tono, "info");
  assert.match(nuevo!.texto, /primer mes y el segundo es gratis/);
  // La clave cambia de un día a otro (el aviso vuelve a salir al día siguiente).
  assert.notEqual(avisoCobro({ ...b, pagadoHasta: "2026-11-19" }, "2026-11-23")?.clave, vencido?.clave);
});

test("corte por mora: 5 días de gracia después del vencimiento", () => {
  const b = { pagadoHasta: "2026-11-21", mesGratisPendiente: false };
  assert.equal(finDeGracia("2026-11-21"), "2026-11-26");
  assert.equal(finDeGracia("2026-12-29"), "2027-01-03");
  assert.equal(accesoCortado(b, "2026-11-21"), false, "el día del vencimiento sigue abierto");
  assert.equal(accesoCortado(b, "2026-11-22"), false, "primer día de gracia");
  assert.equal(accesoCortado(b, "2026-11-26"), false, "último día de gracia");
  assert.equal(accesoCortado(b, "2026-11-27"), true, "al sexto día se bloquea");
  assert.equal(accesoCortado({ ...b, pagadoHasta: "2026-12-21" }, "2026-11-27"), false, "al pagar se abre");
  assert.equal(accesoCortado({ ...b, pagadoHasta: null }, "2026-11-27"), false, "sin fecha no se bloquea");
  // Comercio nuevo que aún no hace su primer pago: tiene la invitación, no el bloqueo.
  assert.equal(accesoCortado({ ...b, mesGratisPendiente: true }, "2026-12-30"), false);
  // El aviso rojo dice hasta cuándo hay plazo y, pasado el plazo, que el panel está en pausa.
  const plan = { ...b, planId: "plan_starter" };
  assert.match(avisoCobro(plan, "2026-11-23")!.texto, /Tienes hasta el 26 de nov/);
  assert.match(avisoCobro(plan, "2026-11-27")!.texto, /en pausa hasta que te pongas al día/);
});
