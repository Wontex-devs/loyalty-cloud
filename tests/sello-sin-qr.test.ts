// Sello sin QR: el motivo es obligatorio y en un domicilio se puede añadir la factura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coincideCliente, esDomicilio, motivoSinQr } from "../src/lib/domain/sello-sin-qr.ts";

test("sin motivo no se puede sumar el sello", () => {
  assert.equal(motivoSinQr("").ok, false);
  assert.equal(motivoSinQr("   no  ").ok, false);
  assert.equal(motivoSinQr("x".repeat(146)).ok, false);
});

test("el motivo se guarda limpio y con la factura al final", () => {
  assert.deepEqual(motivoSinQr("  Pedido   a domicilio "), { ok: true, texto: "Pedido a domicilio" });
  assert.deepEqual(motivoSinQr("Pedido a domicilio", " FV-1234 "), { ok: true, texto: "Pedido a domicilio · Factura FV-1234" });
  // Si escriben «Factura 88» o «#88», no queda «Factura Factura 88».
  assert.deepEqual(motivoSinQr("Pedido a domicilio", "Factura 88"), { ok: true, texto: "Pedido a domicilio · Factura 88" });
  assert.deepEqual(motivoSinQr("Pedido a domicilio", "#88"), { ok: true, texto: "Pedido a domicilio · Factura 88" });
  assert.equal(motivoSinQr("Pedido a domicilio", "9".repeat(41)).ok, false);
  // Cabe en el límite de la base de datos (200).
  const largo = motivoSinQr("x".repeat(145), "9".repeat(40));
  assert.ok(largo.ok && largo.texto.length <= 200);
});

test("se reconoce un domicilio para pedir la factura", () => {
  assert.equal(esDomicilio("Pedido a domicilio"), true);
  assert.equal(esDomicilio("Domicilio por Rappi"), true);
  assert.equal(esDomicilio("El QR no se pudo escanear"), false);
});

test("buscar al cliente por nombre (sin tildes) o por celular", () => {
  assert.equal(coincideCliente("maria", "María José Pérez", "+573001112233"), true);
  assert.equal(coincideCliente("jose perez", "María José Pérez", null), true);
  assert.equal(coincideCliente("2233", "María José Pérez", "+57 300 111 2233"), true);
  assert.equal(coincideCliente("300 111", "María José Pérez", "+573001112233"), true);
  assert.equal(coincideCliente("ana", "María José Pérez", "+573001112233"), false);
  assert.equal(coincideCliente("", "María", "+573001112233"), false);
});
