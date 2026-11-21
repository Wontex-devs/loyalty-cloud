import { test } from "node:test";
import assert from "node:assert/strict";
import { rutaInterna } from "../src/lib/domain/ruta-interna.ts";

const BARRA_INVERTIDA = String.fromCharCode(92);

test("acepta rutas de este mismo sitio", () => {
  assert.equal(rutaInterna("/business/selah"), "/business/selah");
  assert.equal(rutaInterna("/admin/businesses?estado=activo#lista"), "/admin/businesses?estado=activo#lista");
  assert.equal(rutaInterna("/account/password"), "/account/password");
});

test("rechaza todo lo que llevaría a otro sitio", () => {
  for (const malo of [
    "//otro-sitio.example",
    `/${BARRA_INVERTIDA}otro-sitio.example`,
    `/${BARRA_INVERTIDA}/otro-sitio.example`,
    `/${String.fromCharCode(9)}/otro-sitio.example`,
    `/${String.fromCharCode(10)}/otro-sitio.example`,
    "https://otro-sitio.example",
    "javascript:alert(1)",
    "otro-sitio.example",
    "/ /otro-sitio.example",
    "",
  ]) {
    assert.equal(rutaInterna(malo), "/start", JSON.stringify(malo));
  }
  assert.equal(rutaInterna(null), "/start");
  assert.equal(rutaInterna(undefined, "/login"), "/login");
  assert.equal(rutaInterna("/" + "a".repeat(600)), "/start");
});

test("los casos que antes pasaban el filtro viejo sí llevaban a otro sitio", () => {
  // Así lo resuelve el navegador: por eso el filtro «empieza por / y no por //» no alcanzaba.
  const filtroViejo = (v: string) => v.startsWith("/") && !v.startsWith("//");
  for (const v of [`/${BARRA_INVERTIDA}/otro-sitio.example`, `/${String.fromCharCode(9)}/otro-sitio.example`]) {
    assert.equal(filtroViejo(v), true);
    assert.equal(new URL(v, "https://lazo.example").host, "otro-sitio.example");
    assert.equal(rutaInterna(v), "/start");
  }
});
