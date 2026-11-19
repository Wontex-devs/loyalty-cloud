import { test } from "node:test";
import assert from "node:assert/strict";
import { barrasCode128, codigoLegible, esCodigoTarjeta, limpiarCodigo, simbolosCode128C } from "../src/lib/domain/code128.ts";

test("Code 128 C: inicio, pares de dígitos, control y parada", () => {
  // Ejemplo del estándar: «1234» → inicio C (105), 12, 34, control (105 + 12·1 + 34·2) % 103 = 82, parada (106).
  assert.deepEqual(simbolosCode128C("1234"), [105, 12, 34, 82, 106]);
  assert.throws(() => simbolosCode128C("123"));
  assert.throws(() => simbolosCode128C("12a4"));
});

test("las barras de 12 dígitos ocupan siempre lo mismo y empiezan y terminan con barra", () => {
  const a = barrasCode128("482910473365");
  const b = barrasCode128("000000000000");
  // inicio + 6 pares + control = 8 símbolos de 11 módulos, más la parada de 13.
  assert.equal(a.total, 8 * 11 + 13);
  assert.equal(b.total, a.total);
  assert.equal(a.barras[0].x, 0);
  const ultima = a.barras[a.barras.length - 1];
  assert.equal(ultima.x + ultima.ancho, a.total);
});

test("el número se muestra en grupos y se limpia al escribirlo", () => {
  assert.equal(codigoLegible("482910473365"), "4829 1047 3365");
  assert.equal(limpiarCodigo(" 4829-1047 3365 "), "482910473365");
  assert.equal(esCodigoTarjeta("482910473365"), true);
  assert.equal(esCodigoTarjeta("48291047336"), false);
});
