// Nombre y apellido en la inscripción: mayúscula inicial y el nombre aparte para los avisos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPersonName, joinSchema } from "../src/lib/domain/schemas.ts";
import { greetingName, personalize } from "../src/lib/wallet/messages.ts";

test("mayúscula inicial y el resto en minúscula, escriba como escriba", () => {
  assert.equal(formatPersonName("mARÍA  josé"), "María José");
  assert.equal(formatPersonName("  SALLYS "), "Sallys");
  assert.equal(formatPersonName("rodríguez gómez"), "Rodríguez Gómez");
  assert.equal(formatPersonName("ana-maría"), "Ana-María");
  assert.equal(formatPersonName("o'neil"), "O'Neil");
  assert.equal(formatPersonName("ñUÑEZ"), "Ñuñez");
});

const base = { phone: "3001234567", email: "", acceptTerms: true as const, marketingConsent: true };

test("la inscripción pide nombre y apellido y los deja con mayúscula inicial", () => {
  const r = joinSchema.safeParse({ ...base, firstName: "juan CARLOS", lastName: "pérez" });
  assert.ok(r.success);
  assert.equal(r.data.firstName, "Juan Carlos");
  assert.equal(r.data.lastName, "Pérez");
});

test("sin apellido, o con números, no deja inscribirse", () => {
  assert.equal(joinSchema.safeParse({ ...base, firstName: "Ana", lastName: "" }).success, false);
  assert.equal(joinSchema.safeParse({ ...base, firstName: "Ana", lastName: " " }).success, false);
  assert.equal(joinSchema.safeParse({ ...base, firstName: "Ana2", lastName: "Gómez" }).success, false);
});

test("los avisos saludan solo con el nombre (aunque sea compuesto)", () => {
  assert.equal(greetingName({ fullName: "María José Pérez", firstName: "María José" }), "María José");
  assert.equal(greetingName({ fullName: "Sallys Rodríguez" }), "Sallys");
  assert.equal(personalize("Hola {nombre}, te esperamos", "María José Pérez", "María José"), "Hola María José, te esperamos");
});
