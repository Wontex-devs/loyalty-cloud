/**
 * Código de barras Code 128 (juego C: solo números, de dos en dos) para el número de cada tarjeta.
 * Es el mismo formato que dibujan Apple Wallet (PKBarcodeFormatCode128) y Google Wallet (CODE_128),
 * así la tarjeta web, el pase y la cámara del panel hablan el mismo idioma. Sin dependencias.
 */

/** Anchos de barra y espacio de cada símbolo (0 a 106), alternando barra, espacio, barra… */
const PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const INICIO_C = 105;
const PARADA = 106;

/** Número de tarjeta válido: 12 dígitos. */
export const esCodigoTarjeta = (v: string) => /^[0-9]{12}$/.test(v);

/** «482910473365» → «4829 1047 3365», para leerlo o dictarlo. */
export const codigoLegible = (v: string) => v.replace(/(\d{4})(?=\d)/g, "$1 ");

/** Lo que se lee con la cámara o se escribe a mano, sin espacios ni guiones. */
export const limpiarCodigo = (v: string) => (v ?? "").replace(/\D/g, "");

/**
 * Símbolos del código (inicio, datos, control y parada) para una cantidad par de dígitos.
 * El dígito de control es la suma ponderada módulo 103, como manda el estándar.
 */
export function simbolosCode128C(digitos: string): number[] {
  if (!/^(?:[0-9]{2})+$/.test(digitos)) throw new Error("Code 128 C necesita una cantidad par de dígitos");
  const datos: number[] = [];
  for (let i = 0; i < digitos.length; i += 2) datos.push(Number(digitos.slice(i, i + 2)));
  const control = datos.reduce((suma, v, i) => suma + v * (i + 1), INICIO_C) % 103;
  return [INICIO_C, ...datos, control, PARADA];
}

/** Barras del código: cada una con su posición y ancho, en módulos (la unidad más delgada). */
export function barrasCode128(digitos: string): { barras: { x: number; ancho: number }[]; total: number } {
  const barras: { x: number; ancho: number }[] = [];
  let x = 0;
  for (const s of simbolosCode128C(digitos)) {
    const patron = PATRONES[s];
    for (let i = 0; i < patron.length; i++) {
      const ancho = Number(patron[i]);
      if (i % 2 === 0) barras.push({ x, ancho });
      x += ancho;
    }
  }
  return { barras, total: x };
}
