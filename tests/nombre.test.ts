// Pruebas del saludo del panel (datos ficticios).
import { test } from "node:test";
import assert from "node:assert/strict";
import { faltaNombre, nombreParaSaludo } from "../src/lib/domain/nombre.ts";

test("saluda por el primer nombre", () => {
  assert.equal(nombreParaSaludo("Ana María Gómez"), "Ana");
  assert.equal(nombreParaSaludo("  Luis   Pérez "), "Luis");
});

test("no saluda con el correo ni con nombres vacíos", () => {
  assert.equal(nombreParaSaludo("persona.ficticia@ejemplo.com"), null);
  assert.equal(nombreParaSaludo(""), null);
  assert.equal(nombreParaSaludo(null), null);
  assert.equal(nombreParaSaludo("A"), null);
});

test("detecta cuentas sin nombre real", () => {
  assert.equal(faltaNombre("persona.ficticia@ejemplo.com"), true);
  assert.equal(faltaNombre("   "), true);
  assert.equal(faltaNombre("Ana Gómez"), false);
});
