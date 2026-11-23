// Pruebas del enlace que lleva el código QR de cada tarjeta y de cómo lo lee «Escanear tarjeta».
import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDeLectura, contenidoQrPase, enlaceDeSello, esLecturaDeTarjeta } from "../src/lib/domain/enlace-sello.ts";

test("el QR lleva un enlace con el número", () => {
  assert.equal(enlaceDeSello("482910473365", "https://lazo.ejemplo.com/"), "https://lazo.ejemplo.com/sello/482910473365");
  assert.equal(contenidoQrPase("482910473365", "https://lazo.ejemplo.com/card/abc"), "https://lazo.ejemplo.com/sello/482910473365");
  // Sin dirección válida, el pase sigue llevando el número solo.
  assert.equal(contenidoQrPase("482910473365", "no-es-una-url"), "482910473365");
});

test("el escáner lee el enlace nuevo, el número del QR anterior y el número escrito", () => {
  assert.equal(codigoDeLectura("https://lazo.ejemplo.com/sello/482910473365"), "482910473365");
  assert.equal(codigoDeLectura("HTTPS://LAZO.EJEMPLO.COM/SELLO/482910473365/"), "482910473365");
  assert.equal(codigoDeLectura("https://vista-previa.vercel.app/sello/482910473365?x=1"), "482910473365");
  assert.equal(codigoDeLectura("482910473365"), "482910473365");
  assert.equal(codigoDeLectura(" 4829 1047 3365 "), "482910473365");
  assert.equal(esLecturaDeTarjeta("https://lazo.ejemplo.com/sello/482910473365"), true);
});

test("un enlace que no es de una tarjeta no se toma como número", () => {
  assert.equal(codigoDeLectura("https://otro-sitio.com/pagina/482910473365"), "");
  assert.equal(codigoDeLectura("https://lazo.ejemplo.com/sello/48291047336"), "");
  assert.equal(codigoDeLectura("https://lazo.ejemplo.com/sello/482910473365/extra"), "");
  assert.equal(codigoDeLectura("tel:482910473365"), "");
  assert.equal(esLecturaDeTarjeta("https://otro-sitio.com/482910473365"), false);
});
