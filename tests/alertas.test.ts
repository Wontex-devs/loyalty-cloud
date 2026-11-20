import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiarEvento, taparDireccion } from "../src/lib/alertas.ts";

test("las alertas no llevan el enlace de la tarjeta ni el secreto de la etiqueta", () => {
  assert.equal(taparDireccion("https://lazo.example/card/AbC123-xyz?nuevo=1"), "https://lazo.example/card/[token]");
  assert.equal(taparDireccion("https://lazo.example/tap/selah?k=secreto-de-prueba"), "https://lazo.example/tap/selah");
  assert.equal(taparDireccion("Error al abrir /card/tok_prueba/ahora"), "Error al abrir /card/[token]/ahora");
  assert.equal(taparDireccion("/business/selah/escanear"), "/business/selah/escanear");
});

test("el evento se envía sin cookies, encabezados, formularios ni usuario", () => {
  const e = limpiarEvento({
    request: { url: "https://lazo.example/tap/selah?k=secreto", cookies: { a: 1 }, headers: { b: 2 }, data: { celular: "3000000000" }, query_string: "k=secreto" },
    user: { ip_address: "10.0.0.1" },
    breadcrumbs: [{ data: { url: "/card/tok_prueba?x=1", from: "/card/otro", to: "/" } }],
  });
  assert.deepEqual(e.request, { url: "https://lazo.example/tap/selah" });
  assert.equal(e.user, undefined);
  assert.deepEqual(e.breadcrumbs?.[0].data, { url: "/card/[token]", from: "/card/[token]", to: "/" });
});
