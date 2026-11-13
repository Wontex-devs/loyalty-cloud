// Pruebas de las reglas de acceso y estados de cuenta del panel de la plataforma.
import { test } from "node:test";
import assert from "node:assert/strict";
import { esSuperadmin, estadoCuenta, nombreAccion, puedeVerPlataforma } from "../src/lib/domain/acceso.ts";
import { toCsv } from "../src/lib/domain/csv.ts";

const AHORA = new Date("2026-11-12T12:00:00Z").getTime();
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();
const base = { suspendedAt: null, lastSignInAt: null, emailConfirmedAt: null, invitedAt: null };

test("estado de la cuenta", () => {
  assert.equal(estadoCuenta({ ...base, invitedAt: hace(2) }, AHORA), "pendiente");
  assert.equal(estadoCuenta({ ...base, emailConfirmedAt: hace(40), lastSignInAt: hace(3) }, AHORA), "activa");
  assert.equal(estadoCuenta({ ...base, emailConfirmedAt: hace(90), lastSignInAt: hace(45) }, AHORA), "inactiva");
  assert.equal(estadoCuenta({ ...base, emailConfirmedAt: hace(5) }, AHORA), "inactiva", "confirmó pero nunca entró");
  assert.equal(estadoCuenta({ ...base, suspendedAt: hace(1), lastSignInAt: hace(1) }, AHORA), "suspendida", "la suspensión manda");
});

test("quién ve y quién cambia el panel de la plataforma", () => {
  assert.equal(esSuperadmin({ platformRole: "superadmin" }), true);
  assert.equal(esSuperadmin({ platformRole: "superadmin", suspendedAt: hace(1) }), false, "suspendido no administra");
  assert.equal(esSuperadmin({ platformRole: "support" }), false);
  assert.equal(puedeVerPlataforma({ platformRole: "support" }), true);
  assert.equal(puedeVerPlataforma({ platformRole: "support", suspendedAt: hace(1) }), false);
  assert.equal(puedeVerPlataforma({ platformRole: "user" }), false);
  assert.equal(puedeVerPlataforma(null), false);
});

test("nombres de acciones de auditoría", () => {
  assert.equal(nombreAccion("platform.user_suspended"), "Suspendió una cuenta");
  assert.equal(nombreAccion("algo.desconocido"), "algo.desconocido", "si no se conoce, se muestra tal cual");
});

test("CSV protegido contra fórmulas y con tildes", () => {
  const csv = toCsv(["Nombre", "Correo"], [["=HYPERLINK(1)", "ana@ejemplo.com"], ["José, Pérez", null]]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes('"José, Pérez"'));
});
