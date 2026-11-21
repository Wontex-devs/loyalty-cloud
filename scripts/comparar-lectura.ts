// Compara la lectura del código QR contra el código de barras (Code 128) con el mismo lector del
// panel (ZXing) y el mismo número de tarjeta. Simula lo que ve la cámara: el código ocupa cierto
// ancho del cuadro (distancia), está girado (cómo sostienen el celular) y algo borroso (enfoque).
// No reemplaza la prueba con un celular real, pero mide lo mismo en las mismas condiciones.
// Uso: npm run comparar:lectura
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  EncodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  QRCodeWriter,
  RGBLuminanceSource,
} from "@zxing/library";
import { barrasCode128 } from "../src/lib/domain/code128.ts";

const CODIGO = "482910473365";
const ANCHO = 640;
const ALTO = 480;

type Modulos = { ancho: number; alto: number; negro: (x: number, y: number) => boolean };

function modulosQr(): Modulos {
  const pistas = new Map();
  pistas.set(EncodeHintType.MARGIN, 0);
  const m = new QRCodeWriter().encode(CODIGO, BarcodeFormat.QR_CODE, 1, 1, pistas);
  return { ancho: m.getWidth(), alto: m.getHeight(), negro: (x, y) => m.get(x, y) };
}

function modulosBarras(): Modulos {
  const { barras, total } = barrasCode128(CODIGO);
  const fila = new Uint8Array(total);
  for (const b of barras) fila.fill(1, b.x, b.x + b.ancho);
  // Mismo alto relativo que en la tarjeta: las barras miden unas 3 veces menos de alto que de ancho.
  return { ancho: total, alto: Math.round(total / 3), negro: (x) => fila[x] === 1 };
}

/** Lo que ve la cámara: el código centrado, ocupando `ocupa` del ancho, girado `grados` y con `borroso` px de desenfoque. */
function cuadro(m: Modulos, ocupa: number, grados: number, borroso: number): Uint8ClampedArray {
  const px = (ANCHO * ocupa) / m.ancho; // píxeles por módulo
  const rad = (grados * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lum = new Float32Array(ANCHO * ALTO).fill(235);
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const dx = x - ANCHO / 2;
      const dy = y - ALTO / 2;
      const u = (dx * cos + dy * sin) / px + m.ancho / 2;
      const v = (-dx * sin + dy * cos) / px + m.alto / 2;
      if (u >= 0 && v >= 0 && u < m.ancho && v < m.alto && m.negro(Math.floor(u), Math.floor(v))) lum[y * ANCHO + x] = 25;
    }
  }
  // Desenfoque sencillo (promedio en cuadro), dos pasadas.
  let a = lum;
  for (let paso = 0; paso < 2 && borroso > 0; paso++) {
    const b = new Float32Array(a.length);
    const r = borroso;
    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        let s = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < ANCHO) {
            s += a[y * ANCHO + xx];
            n++;
          }
        }
        b[y * ANCHO + x] = s / n;
      }
    }
    const c = new Float32Array(a.length);
    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        let s = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < ALTO) {
            s += b[yy * ANCHO + x];
            n++;
          }
        }
        c[y * ANCHO + x] = s / n;
      }
    }
    a = c;
  }
  return Uint8ClampedArray.from(a);
}

function lector(formato: BarcodeFormat, esforzarse: boolean) {
  const pistas = new Map();
  pistas.set(DecodeHintType.POSSIBLE_FORMATS, [formato]);
  if (esforzarse) pistas.set(DecodeHintType.TRY_HARDER, true);
  const r = new MultiFormatReader();
  r.setHints(pistas);
  return r;
}

function leer(r: MultiFormatReader, lum: Uint8ClampedArray) {
  // El lector escribe un aviso cada vez que no encuentra el código: aquí se silencia.
  const { error, warn } = console;
  console.error = console.warn = () => {};
  const inicio = performance.now();
  let ok = false;
  try {
    ok = r.decodeWithState(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, ANCHO, ALTO)))).getText() === CODIGO;
  } catch {
    ok = false;
  }
  const ms = performance.now() - inicio;
  console.error = error;
  console.warn = warn;
  return { ok, ms };
}

const casos: { ocupa: number; grados: number; borroso: number }[] = [];
for (const ocupa of [0.7, 0.5, 0.35, 0.25]) for (const grados of [0, 8, 20, 45, 90]) for (const borroso of [0, 1, 2]) casos.push({ ocupa, grados, borroso });

const candidatos = [
  // Tamaños reales en la tarjeta: el QR mide 132 px de lado y el código de barras medía 276 px de ancho.
  // A la misma distancia, el QR ocupa menos ancho del cuadro; aun así sus cuadros son más grandes.
  { nombre: "QR", modulos: modulosQr(), lector: lector(BarcodeFormat.QR_CODE, false), tamano: 132 / 276 },
  // El código de barras se probaba con «TRY_HARDER», como estaba en el panel.
  { nombre: "Código de barras", modulos: modulosBarras(), lector: lector(BarcodeFormat.CODE_128, true), tamano: 1 },
];

console.log(`\nMismo número (${CODIGO}), mismo lector, ${casos.length} situaciones de cámara (distancia × giro × desenfoque)\n`);
for (const c of candidatos) {
  let leidos = 0;
  let msLeidos = 0;
  let msTotal = 0;
  const porGiro: Record<number, number> = {};
  for (const caso of casos) {
    const img = cuadro(c.modulos, caso.ocupa * c.tamano, caso.grados, caso.borroso);
    const r = leer(c.lector, img);
    msTotal += r.ms;
    if (r.ok) {
      leidos++;
      msLeidos += r.ms;
      porGiro[caso.grados] = (porGiro[caso.grados] ?? 0) + 1;
    }
  }
  const porGiroTxt = [0, 8, 20, 45, 90].map((g) => `${g}°: ${porGiro[g] ?? 0}/12`).join("  ");
  console.log(`${c.nombre.padEnd(17)} leídos ${String(leidos).padStart(2)}/${casos.length} (${Math.round((leidos / casos.length) * 100)} %)   ` + `tiempo medio por intento ${(msTotal / casos.length).toFixed(1)} ms` + (leidos ? `, por lectura lograda ${(msLeidos / leidos).toFixed(1)} ms` : ""));
  console.log(`${"".padEnd(17)} cuadros a lo ancho: ${c.modulos.ancho}   por giro → ${porGiroTxt}\n`);
}
