// «Sellos y premio»: lo que envía el panel al guardar el programa debe pasar la validación del servidor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { programPatchSchema } from "../src/lib/domain/schemas.ts";

const base = { name: "LAZO", description: "", stampsRequired: 9, rewardName: "Café gratis", rewardDescription: "", minMinutesBetweenVisits: 120, welcomeStamps: 0, terms: "" };

test("se guarda sin regalo de cumpleaños ni vencimiento (el panel los manda como null)", () => {
  const r = programPatchSchema.safeParse({ ...base, rewardExpiryDays: null, birthdayReward: null });
  assert.equal(r.success, true, JSON.stringify(!r.success && r.error.issues));
  assert.equal(r.data?.birthdayReward, null);
  assert.equal(r.data?.rewardExpiryDays, null);
});

test("también con regalo de cumpleaños y vencimiento", () => {
  const r = programPatchSchema.safeParse({ ...base, rewardExpiryDays: 30, birthdayReward: "Postre gratis" });
  assert.equal(r.success, true);
  assert.equal(r.data?.birthdayReward, "Postre gratis");
});

test("solo pausar o activar el programa", () => {
  assert.equal(programPatchSchema.safeParse({ active: false }).success, true);
});

test("sigue rechazando datos inválidos", () => {
  assert.equal(programPatchSchema.safeParse({ ...base, stampsRequired: 1 }).success, false);
  assert.equal(programPatchSchema.safeParse({ ...base, birthdayReward: "x".repeat(81) }).success, false);
  assert.equal(programPatchSchema.safeParse({ ...base, rewardName: "x" }).success, false);
});

test("una tarjeta tiene de 2 a 15 sellos", async () => {
  const { programPatchSchema, SELLOS_MAX } = await import("../src/lib/domain/schemas.ts");
  assert.equal(SELLOS_MAX, 15);
  assert.equal(programPatchSchema.safeParse({ stampsRequired: 15 }).success, true);
  assert.equal(programPatchSchema.safeParse({ stampsRequired: 16 }).success, false);
  assert.equal(programPatchSchema.safeParse({ stampsRequired: 1 }).success, false);
});
