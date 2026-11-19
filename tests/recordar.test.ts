import { test } from "node:test";
import assert from "node:assert/strict";
import { agregarTarjeta, esNavegadorDeApp, escribirTarjetas, leerTarjetas, MAX_TARJETAS_RECORDADAS } from "../src/lib/domain/recordar.ts";

const t = (n: number) => `tarjeta-de-prueba-${String(n).padStart(4, "0")}`;

test("la cookie guarda las tarjetas, la más reciente primero y sin repetir", () => {
  let lista = leerTarjetas(undefined);
  lista = agregarTarjeta(lista, t(1));
  lista = agregarTarjeta(lista, t(2));
  lista = agregarTarjeta(lista, t(1));
  assert.deepEqual(lista, [t(1), t(2)]);
  assert.deepEqual(leerTarjetas(escribirTarjetas(lista)), [t(1), t(2)]);
});

test("la cookie no crece sin límite e ignora valores raros", () => {
  let lista: string[] = [];
  for (let i = 0; i < 20; i++) lista = agregarTarjeta(lista, t(i));
  assert.equal(lista.length, MAX_TARJETAS_RECORDADAS);
  assert.equal(lista[0], t(19));
  assert.deepEqual(leerTarjetas(`${t(1)}.<script>.corto.${t(2)}`), [t(1), t(2)]);
  assert.deepEqual(agregarTarjeta([t(1)], "no válido"), [t(1)]);
});

test("reconoce los navegadores de Instagram, Facebook, WhatsApp y TikTok, pero no Safari ni Chrome", () => {
  assert.equal(esNavegadorDeApp("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0"), true);
  assert.equal(esNavegadorDeApp("Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/480.0]"), true);
  assert.equal(esNavegadorDeApp("Mozilla/5.0 (Linux; Android 14) WhatsApp/2.24"), true);
  assert.equal(esNavegadorDeApp("Mozilla/5.0 (Linux; Android 14) musical_ly_34.0"), true);
  assert.equal(esNavegadorDeApp("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), false);
  assert.equal(esNavegadorDeApp("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"), false);
});
