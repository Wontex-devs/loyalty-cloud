"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, Check, Gift, Nfc, Scissors, Users, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { LazoLogo, LazoMark } from "@/components/brand/lazo-logo";

/*
 * Historia de Lazo en 11 escenas, movida por el desplazamiento de la página.
 * La sección es alta y el escenario queda fijo; el avance (T, de 0 a 11) se suaviza en cada cuadro
 * y `aplicar` escribe directamente transform y opacity en cada pieza (nada de estado de React por cuadro).
 * Con «reducir movimiento» cada escena se muestra quieta y se pasa de una a otra con un fundido.
 */

const N = 11;

const ESCENAS = [
  ["Un cliente compra y se va.", "Paga, sale por la puerta y no hay nada que lo haga volver."],
  ["Y la próxima vez, compra en otro lado.", "La competencia está a una cuadra. Sin un motivo para elegirte, cualquiera le sirve."],
  ["Aquí entra Lazo.", "Una tarjeta de sellos digital con la marca de tu negocio, en el celular de cada cliente."],
  ["Escanea el QR una sola vez.", "Escribe su nombre y su celular, y ya tiene su tarjeta. No descarga ninguna app."],
  ["La guarda en Google Wallet.", "En Android queda en la billetera del celular, con tu logo y tus colores, siempre a la mano."],
  ["Acerca el celular al mostrador.", "Una etiqueta NFC adhesiva hace el trabajo. Sin lector ni datáfono."],
  ["Sello registrado.", "Queda guardado con fecha y hora, y le llega el aviso al instante."],
  ["Completa los sellos y gana su premio.", "El premio aparece solo en su tarjeta, listo para canjearlo en tu caja."],
  ["Y vuelve. Una y otra vez.", "Ahora tiene un motivo para elegirte a ti y no a la competencia."],
  ["Tú lo ves todo desde tu panel.", "Quién vuelve, quién dejó de venir y a quién avisarle hoy."],
  ["Clientes que vuelven.", "Más visitas, información real y una relación con tus clientes que dura."],
] as const;

/** Momento quieto de cada escena para «reducir movimiento». */
const QUIETO = [0.55, 1.95, 2.6, 3.92, 4.85, 5.65, 6.6, 7.72, 8.98, 9.76, 10.9];

const SOL = "#ffc928";

// ——— Utilidades de tiempo ———
const lim = (v: number) => Math.min(1, Math.max(0, v));
const tramo = (T: number, a: number, b: number) => lim((T - a) / (b - a));
const sal = (t: number) => 1 - (1 - t) ** 3;
const suave = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const rebote = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;
const px = (v: number) => `${v.toFixed(2)}px`;

// ——— Plano isométrico de la calle (cuadro de 640 × 640) ———
type P = readonly [number, number];
const U = 24;
const iso = (i: number, j: number, z = 0): P => [320 + (i - j) * U * 0.866, 300 + (i + j) * U * 0.5 - z * U];
const puntos = (...ps: P[]) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function ruta(ws: [number, number][]) {
  const ps = ws.map(([i, j]) => iso(i, j));
  const largos = ps.slice(1).map((p, k) => Math.hypot(p[0] - ps[k][0], p[1] - ps[k][1]));
  const total = largos.reduce((a, b) => a + b, 0);
  return {
    d: "M" + ps.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L"),
    /** Fracción del recorrido en la que se llega al punto k. */
    hasta: (k: number) => largos.slice(0, k).reduce((a, b) => a + b, 0) / total,
    en(u: number): P {
      let r = lim(u) * total;
      for (let k = 0; k < largos.length; k++) {
        if (r <= largos[k] || k === largos.length - 1) {
          const t = largos[k] ? Math.min(1, r / largos[k]) : 0;
          return [mezcla(ps[k][0], ps[k + 1][0], t), mezcla(ps[k][1], ps[k + 1][1], t)];
        }
        r -= largos[k];
      }
      return ps[ps.length - 1];
    },
  };
}

const PUERTA: [number, number] = [-1.0, 3.3];
const LLEGA = ruta([[6.4, 3.3], PUERTA]);
const SE_VA = ruta([PUERTA, [1.5, 3.3], [1.5, -4.5], [1.2, -4.5], [1.5, -4.5], [1.5, -1.4], [5.1, -1.4]]);
const VUELVE = ruta([[5.1, -1.4], [1.5, -1.4], [1.5, 3.3], PUERTA]);
const EN_COMPETENCIA = SE_VA.hasta(3);
/** Centro de «Tu local» en el piso: ahí se cierra el lazo. */
const CENTRO: P = iso(-2.5, 3.3);
const ARO_LOCAL = `M${CENTRO[0] + 80} ${CENTRO[1]}A80 46 0 1 1 ${CENTRO[0] - 80} ${CENTRO[1]}A80 46 0 1 1 ${CENTRO[0] + 80} ${CENTRO[1]}`;
const ARO_LAZO = "M53 25C50 32 43 34 34 35A16.5 14 0 1 0 10 55A16.5 14 0 1 0 34 35";

const SEMANAS = [22, 28, 25, 34, 31, 42, 47, 55];
const LINEA = SEMANAS.map((v, k) => `${k ? "L" : "M"}${(k * 250) / 7} ${(100 - (v / 60) * 90).toFixed(1)}`).join("");
const KPIS = [
  [248, "", "Clientes"],
  [65, "", "Visitas en 30 días"],
  [89, "%", "Vuelven"],
  [12, "", "Premios canjeados"],
] as const;
const AVISOS = [
  ["LG", "Laura G.", "Le falta 1 sello"],
  ["AP", "Andrés P.", "No viene hace 21 días"],
  ["SM", "Sofía M.", "Cumple años el viernes"],
] as const;
const INICIO_SELLOS = [6.1, 7.05, 7.14, 7.23, 7.32, 7.41];

type Mapa = Record<string, HTMLElement | SVGElement>;

/** Escribe en cada pieza su estado para el instante T (0 a 11). */
function aplicar(m: Mapa, T: number) {
  const st = (k: string, transform?: string, opacidad?: number) => {
    const n = m[k];
    if (!n) return;
    if (transform !== undefined) n.style.transform = transform;
    if (opacidad !== undefined) n.style.opacity = String(Math.round(lim(opacidad) * 1000) / 1000);
  };
  const traza = (k: string, v: number) => {
    const n = m[k];
    if (n) n.style.strokeDashoffset = String(1 - lim(v));
  };
  const texto = (k: string, v: string) => {
    const n = m[k];
    if (n && n.textContent !== v) n.textContent = v;
  };

  // Progreso
  for (let k = 0; k < N; k++) st(`barra${k}`, `scaleX(${lim(T - k).toFixed(3)})`);

  // ——— Calle ———
  const apaga = sal(tramo(T, 2.7, 2.98));
  const regresa = sal(tramo(T, 7.95, 8.25));
  const sale = sal(tramo(T, 9.0, 9.25));
  const fin = sal(tramo(T, 9.95, 10.3));
  const atenua = T < 5 ? 1 - 0.55 * sal(tramo(T, 1.95, 2.2)) : 1;
  let escala: number;
  let dy = 0;
  if (T < 5) escala = 1 + 0.18 * sal(tramo(T, 2.35, 2.95));
  else if (T < 9.6) escala = mezcla(0.92, 1, regresa);
  else {
    const f = sal(tramo(T, 9.95, 10.45));
    escala = mezcla(1, 0.84, f);
    dy = -46 * f;
  }
  st("mapa", `translate3d(0, ${px(dy)}, 0) scale(${escala.toFixed(4)})`, (1 - apaga + regresa - sale + fin) * atenua);

  // El cliente: llega, compra, se va a la competencia y, con Lazo, vuelve.
  let pos: P;
  let recorrido = 0;
  if (T < 0.6) pos = LLEGA.en(suave(tramo(T, 0.05, 0.4)));
  else if (T < 8.05) {
    recorrido = T < 1.42 ? EN_COMPETENCIA * suave(tramo(T, 0.6, 1.35)) : mezcla(EN_COMPETENCIA, 1, suave(tramo(T, 1.5, 1.85)));
    pos = SE_VA.en(recorrido);
  } else {
    recorrido = 1;
    pos = VUELVE.en(suave(tramo(T, 8.12, 8.66)));
  }
  const visible =
    tramo(T, 0, 0.08) *
    (1 - tramo(T, 0.36, 0.42) + tramo(T, 0.58, 0.64)) *
    (1 - tramo(T, 1.33, 1.38) + tramo(T, 1.48, 1.53)) *
    (1 - tramo(T, 8.64, 8.7));
  st("cliente", `translate(${px(pos[0])}, ${px(pos[1])})`, visible);
  traza("rastro", recorrido);
  st("rastro", undefined, 0.7 * (1 - tramo(T, 8.15, 8.45)));
  traza("regreso", suave(tramo(T, 8.12, 8.66)));
  traza("aroLocal", suave(tramo(T, 8.55, 9.0)));
  const luz = 1 - 0.75 * tramo(T, 1.0, 1.7) + 0.75 * tramo(T, 8.62, 8.9);
  st("luz", undefined, luz);
  st("luzPiso", undefined, luz);

  const compra = sal(tramo(T, 0.42, 0.5));
  st("chipCompra", `translateY(${px(8 * (1 - compra))})`, compra * (1 - tramo(T, 0.86, 0.94)));
  const duda = sal(tramo(T, 0.94, 1.02));
  st("chipDuda", `translateY(${px(8 * (1 - duda))})`, duda * (1 - tramo(T, 1.55, 1.7)));
  const m1 = sal(tramo(T, 1.36, 1.44));
  st("moneda1", `translateY(${px(8 * (1 - m1))})`, m1);
  const m2 = sal(tramo(T, 1.86, 1.94));
  st("moneda2", `translateY(${px(8 * (1 - m2))})`, m2);
  const visita = sal(tramo(T, 8.68, 8.8));
  st("chipVisita", `translateY(${px(8 * (1 - visita))})`, visita);

  // El aro de Lazo se dibuja sobre la calle y se abre hacia el celular.
  const marcaEntra = sal(tramo(T, 1.95, 2.15));
  const marcaSale = sal(tramo(T, 2.72, 3.0));
  st("marca", `scale(${(0.92 + 0.08 * marcaEntra + 0.45 * marcaSale).toFixed(4)})`, marcaEntra * (1 - marcaSale));
  traza("marcaTrazo", suave(tramo(T, 2.0, 2.55)));

  const orbita = sal(tramo(T, 10.1, 10.45));
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + (T - 10) * 2.2;
    st(`orbita${k}`, `translate(${px(CENTRO[0] + 80 * Math.cos(a))}, ${px(CENTRO[1] + 46 * Math.sin(a))})`, orbita);
  }

  // ——— Celular ———
  const entra = sal(tramo(T, 2.8, 3.25));
  const seVa = sal(tramo(T, 7.78, 8.02));
  const baja = suave(tramo(T, 5.1, 5.5)) - suave(tramo(T, 5.85, 6.15));
  st(
    "telefono",
    `perspective(1400px) translate3d(0, ${px(90 * (1 - entra) - 40 * seVa + 30 * baja)}, 0) rotateX(${(20 * (1 - entra) + 20 * baja).toFixed(2)}deg) rotateY(${(-9 * (1 - baja)).toFixed(2)}deg) rotateZ(${(-5 * (1 - entra)).toFixed(2)}deg) scale(${(0.94 + 0.06 * entra - 0.24 * baja - 0.04 * seVa).toFixed(4)})`,
    entra * (1 - seVa),
  );

  st("pantallaA", undefined, 1 - tramo(T, 3.42, 3.52));
  st("pantallaB", undefined, tramo(T, 3.42, 3.52) * (1 - tramo(T, 3.98, 4.06)));
  st("pantallaC", undefined, tramo(T, 3.98, 4.06) * (1 - tramo(T, 4.92, 5.02)));
  st("pantallaE", undefined, tramo(T, 4.92, 5.02));

  // QR
  st("escaneo", `translateY(${px(196 * suave(tramo(T, 3.0, 3.3)))})`, tramo(T, 2.98, 3.02) * (1 - tramo(T, 3.3, 3.34)));
  const detectado = tramo(T, 3.3, 3.36);
  st("esquinasSol", undefined, detectado);
  st("qrListo", `translateY(${px(6 * (1 - detectado))})`, detectado);

  // Inscripción
  const escribe = (k: string, v: number) => {
    const n = m[k];
    if (n) n.style.clipPath = `inset(0 ${(100 - 100 * v).toFixed(1)}% 0 0)`;
  };
  escribe("nombre", tramo(T, 3.52, 3.66));
  escribe("celular", tramo(T, 3.66, 3.82));
  const acepta = sal(tramo(T, 3.84, 3.9));
  st("check", `scale(${(0.6 + 0.4 * acepta).toFixed(3)})`, acepta);
  st("btnCrear", `scale(${(1 - 0.04 * (tramo(T, 3.9, 3.93) - tramo(T, 3.95, 3.98))).toFixed(3)})`);

  // Tarjeta nueva → Google Wallet
  const nueva = sal(tramo(T, 3.98, 4.18));
  const guarda = suave(tramo(T, 4.45, 4.78));
  st("paseNuevo", `translateY(${px(mezcla(18, 0, nueva) - 44 * guarda)}) scale(${mezcla(0.94, 1, nueva).toFixed(4)})`, nueva);
  st("creada", `translateY(${px(-8 * guarda)})`, nueva * (1 - guarda));
  st("btnWallet", `scale(${(1 - 0.04 * (tramo(T, 4.36, 4.4) - tramo(T, 4.42, 4.46))).toFixed(3)})`, nueva * (1 - tramo(T, 4.46, 4.54)));
  st("pila", `translateY(${px(10 * (1 - guarda))})`, guarda);
  st("wTitulo", undefined, guarda);
  const toast = sal(tramo(T, 4.7, 4.8)) * (1 - tramo(T, 4.92, 4.98));
  st("toast", `translateY(${px(12 * (1 - toast))})`, toast);

  // Mostrador con la etiqueta NFC
  const mostrador = sal(tramo(T, 4.92, 5.2)) * (1 - sal(tramo(T, 6.05, 6.35)));
  st("mostrador", `perspective(900px) translateY(${px(50 * (1 - mostrador))}) rotateX(58deg)`, mostrador);
  for (let k = 0; k < 3; k++) {
    const t = tramo(T, 5.42 + 0.1 * k, 5.75 + 0.1 * k);
    st(`anillo${k}`, `scale(${(0.6 + 1.8 * sal(t)).toFixed(3)})`, Math.sin(Math.PI * t) * 0.9);
  }
  st("etiquetaLuz", undefined, tramo(T, 5.45, 5.52) * (1 - tramo(T, 6.0, 6.12)));

  // Sellos y premio
  let sellos = 0;
  INICIO_SELLOS.forEach((t0, i) => {
    const v = tramo(T, t0, t0 + 0.08);
    if (v >= 0.5) sellos++;
    st(`sello${i}`, `scale(${(0.5 + 0.5 * rebote(v)).toFixed(3)})`, v * 3);
  });
  texto("cuenta", `${sellos}/6`);
  const aviso = sal(tramo(T, 6.22, 6.4)) * (1 - sal(tramo(T, 6.85, 7.0)));
  st("aviso", `translateY(${px(-70 * (1 - aviso))})`, aviso);
  const premio = sal(tramo(T, 7.5, 7.68));
  st("premio", `translateY(${px(24 * (1 - premio))}) scale(${(0.94 + 0.06 * premio).toFixed(3)})`, premio);
  const chispa = tramo(T, 7.52, 7.92);
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5;
    const d = 18 + 60 * sal(chispa);
    st(`chispa${k}`, `translate(${px(Math.cos(a) * d)}, ${px(Math.sin(a) * d)}) scale(${(1 - 0.5 * chispa).toFixed(3)})`, Math.sin(Math.PI * chispa));
  }

  // ——— Panel ———
  const pIn = sal(tramo(T, 9.02, 9.4));
  const pOut = sal(tramo(T, 9.82, 10.05));
  st(
    "panel",
    `perspective(1600px) translateY(${px(50 * (1 - pIn) - 30 * pOut)}) rotateX(${(4 + 14 * (1 - pIn)).toFixed(2)}deg) rotateY(${(-8 - 10 * (1 - pIn)).toFixed(2)}deg) scale(${(0.96 + 0.04 * pIn - 0.04 * pOut).toFixed(4)})`,
    pIn * (1 - pOut),
  );
  const cuenta = suave(tramo(T, 9.2, 9.6));
  KPIS.forEach(([v, sufijo], k) => texto(`kpi${k}`, `${Math.round(v * cuenta)}${sufijo}`));
  traza("linea", suave(tramo(T, 9.25, 9.7)));
  st("area", undefined, tramo(T, 9.5, 9.7) * 0.9);
  for (let k = 0; k < AVISOS.length; k++) {
    const v = sal(tramo(T, 9.4 + k * 0.07, 9.55 + k * 0.07));
    st(`fila${k}`, `translateY(${px(10 * (1 - v))})`, v);
  }

  // ——— Cierre ———
  const cierre = sal(tramo(T, 10.3, 10.7));
  st("cierre", `translateY(${px(16 * (1 - cierre))})`, cierre);
}

// ——— Piezas de la calle ———
function Bloque({ i, j, w, d, h, tope, der, izq, children }: { i: number; j: number; w: number; d: number; h: number; tope: string; der: string; izq: string; children?: ReactNode }) {
  const [sx, sy] = iso(i + w / 2 + 0.6, j + d / 2 + 0.4);
  return (
    <g>
      <ellipse cx={sx} cy={sy} rx={(w + d) * U * 0.5} ry={(w + d) * U * 0.26} fill="url(#hl-sombra)" />
      <polygon points={puntos(iso(i + w, j), iso(i + w, j + d), iso(i + w, j + d, h), iso(i + w, j, h))} fill={der} />
      <polygon points={puntos(iso(i, j + d), iso(i + w, j + d), iso(i + w, j + d, h), iso(i, j + d, h))} fill={izq} />
      <polygon points={puntos(iso(i, j, h), iso(i + w, j, h), iso(i + w, j + d, h), iso(i, j + d, h))} fill={tope} stroke="rgb(255 255 255 / 0.18)" strokeWidth="1" />
      {children}
    </g>
  );
}

/** Rectángulo sobre la cara que mira a la derecha (i fijo). */
const caraDer = (i: number, j1: number, j2: number, z1: number, z2: number) => puntos(iso(i, j1, z1), iso(i, j2, z1), iso(i, j2, z2), iso(i, j1, z2));
/** Rectángulo sobre la cara que mira a la izquierda (j fijo). */
const caraIzq = (j: number, i1: number, i2: number, z1: number, z2: number) => puntos(iso(i1, j, z1), iso(i2, j, z1), iso(i2, j, z2), iso(i1, j, z2));

function Etiqueta({ x, y, texto, tono }: { x: number; y: number; texto: string; tono: "sol" | "gris" | "blanco" }) {
  const ancho = texto.length * 7.4 + 26;
  const colores = { sol: [SOL, "#0e1a52"], gris: ["#2c3450", "#c9cfdf"], blanco: ["#ffffff", "#0e1a52"] }[tono];
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <rect x={-ancho / 2} y={-13} width={ancho} height={26} rx={13} fill={colores[0]} />
      <text y={4.5} textAnchor="middle" fontSize="13" fontWeight="600" fill={colores[1]} style={{ fontFamily: "var(--font-text)" }}>
        {texto}
      </text>
    </g>
  );
}

function Calle({ r }: { r: (k: string) => (n: Element | null) => void }) {
  const borde = 6.5;
  const lineas = [];
  for (let k = -6; k <= 6; k++) {
    const [a, b] = [iso(k, -borde), iso(k, borde)];
    const [c, d] = [iso(-borde, k), iso(borde, k)];
    lineas.push(<line key={`i${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />, <line key={`j${k}`} x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} />);
  }
  const banda = (i1: number, i2: number, j1: number, j2: number) => puntos(iso(i1, j1), iso(i2, j1), iso(i2, j2), iso(i1, j2));
  const tu = iso(-2.5, 3.3, 2.4);
  const c1 = iso(-0.1, -4.5, 2.0);
  const c2 = iso(5.1, -2.9, 1.7);
  const ventana = "#ffe7a3";

  return (
    <svg viewBox="0 0 640 640" width="640" height="640" className="absolute inset-0 overflow-visible">
      <defs>
        <radialGradient id="hl-sombra">
          <stop offset="0" stopColor="#030720" stopOpacity="0.55" />
          <stop offset="1" stopColor="#030720" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hl-luz">
          <stop offset="0" stopColor={SOL} stopOpacity="0.55" />
          <stop offset="1" stopColor={SOL} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hl-piso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2b86" />
          <stop offset="1" stopColor="#13216c" />
        </linearGradient>
      </defs>

      {/* Piso */}
      <polygon points={puntos(iso(borde, -borde), iso(borde, borde), iso(borde, borde, -0.5), iso(borde, -borde, -0.5))} fill="#0b1550" />
      <polygon points={puntos(iso(-borde, borde), iso(borde, borde), iso(borde, borde, -0.5), iso(-borde, borde, -0.5))} fill="#0e1a5e" />
      <polygon points={puntos(iso(-borde, -borde), iso(borde, -borde), iso(borde, borde), iso(-borde, borde))} fill="url(#hl-piso)" />
      <g stroke="rgb(255 255 255 / 0.05)" strokeWidth="1">{lineas}</g>

      {/* Calles */}
      <g fill="#24389e">
        <polygon points={banda(-1.2, borde, 2.8, 3.8)} />
        <polygon points={banda(1.0, 2.0, -borde, borde)} />
        <polygon points={banda(2.0, borde, -1.9, -0.9)} />
      </g>
      <g stroke="rgb(255 255 255 / 0.22)" strokeWidth="1.5" strokeDasharray="7 9" fill="none">
        <path d={`M${iso(-1.2, 3.3).join(" ")}L${iso(borde, 3.3).join(" ")}`} />
        <path d={`M${iso(1.5, -borde).join(" ")}L${iso(1.5, borde).join(" ")}`} />
        <path d={`M${iso(2.0, -1.4).join(" ")}L${iso(borde, -1.4).join(" ")}`} />
      </g>

      {/* Edificios de relleno, al fondo */}
      <Bloque i={-5.8} j={-5.8} w={1.6} d={1.6} h={1.3} tope="#24379a" der="#16246e" izq="#1b2c82" />
      <Bloque i={-3.5} j={-5.9} w={1.5} d={1.5} h={0.9} tope="#24379a" der="#16246e" izq="#1b2c82" />
      <Bloque i={-5.9} j={-2.6} w={1.5} d={1.5} h={1.6} tope="#24379a" der="#16246e" izq="#1b2c82" />

      {/* La competencia */}
      <Bloque i={-1.2} j={-5.6} w={2.2} d={2.2} h={2.0} tope="#5b6585" der="#363f5e" izq="#454f70">
        <polygon points={caraDer(1.0, -5.6, -3.4, 1.55, 1.85)} fill="#7b84a3" />
        <polygon points={caraDer(1.0, -5.4, -4.95, 0.7, 1.4)} fill="#c9cfdf" opacity="0.55" />
        <polygon points={caraDer(1.0, -4.75, -4.25, 0, 1.3)} fill="#232a45" />
        <polygon points={caraDer(1.0, -4.05, -3.6, 0.7, 1.4)} fill="#c9cfdf" opacity="0.55" />
      </Bloque>

      {/* Tu local */}
      <g ref={r("luzPiso")}>
        <ellipse cx={iso(-0.6, 3.3)[0]} cy={iso(-0.6, 3.3)[1]} rx="90" ry="44" fill="url(#hl-luz)" />
      </g>
      <Bloque i={-3.8} j={2.0} w={2.6} d={2.6} h={2.4} tope="#4a6af5" der="#1b3fd8" izq="#2a4ee6">
        {Array.from({ length: 6 }, (_, k) => (
          <polygon key={k} points={caraDer(-1.2, 2.0 + (k * 2.6) / 6, 2.0 + ((k + 1) * 2.6) / 6, 1.95, 2.3)} fill={k % 2 ? "#ffffff" : SOL} />
        ))}
        {Array.from({ length: 6 }, (_, k) => (
          <polygon key={k} points={caraIzq(4.6, -3.8 + (k * 2.6) / 6, -3.8 + ((k + 1) * 2.6) / 6, 1.95, 2.3)} fill={k % 2 ? "#e9eefc" : "#e6b520"} />
        ))}
        <polygon points={caraDer(-1.2, 2.15, 2.85, 0.75, 1.7)} fill="#0e1a52" />
        <polygon points={caraDer(-1.2, 3.05, 3.55, 0, 1.45)} fill="#0e1a52" />
        <polygon points={caraDer(-1.2, 3.75, 4.45, 0.75, 1.7)} fill="#0e1a52" />
        <polygon points={caraIzq(4.6, -3.45, -1.6, 0.75, 1.7)} fill="#0e1a52" />
      </Bloque>
      {/* Las ventanas encendidas van aparte para poder apagarlas */}
      <g ref={r("luz")} fill={ventana}>
        <polygon points={caraDer(-1.2, 2.15, 2.85, 0.75, 1.7)} />
        <polygon points={caraDer(-1.2, 3.05, 3.55, 0, 1.45)} />
        <polygon points={caraDer(-1.2, 3.75, 4.45, 0.75, 1.7)} />
        <polygon points={caraIzq(4.6, -3.45, -1.6, 0.75, 1.7)} opacity="0.85" />
      </g>

      <Bloque i={4.1} j={-3.9} w={2.0} d={2.0} h={1.7} tope="#5b6585" der="#363f5e" izq="#454f70">
        <polygon points={caraIzq(-1.9, 4.1, 6.1, 1.3, 1.58)} fill="#7b84a3" />
        <polygon points={caraIzq(-1.9, 4.3, 4.7, 0.6, 1.15)} fill="#c9cfdf" opacity="0.55" />
        <polygon points={caraIzq(-1.9, 4.85, 5.35, 0, 1.15)} fill="#232a45" />
        <polygon points={caraIzq(-1.9, 5.55, 5.95, 0.6, 1.15)} fill="#c9cfdf" opacity="0.55" />
      </Bloque>
      <Bloque i={3.0} j={4.4} w={1.5} d={1.5} h={1.1} tope="#24379a" der="#16246e" izq="#1b2c82" />

      {/* Recorridos */}
      <path ref={r("rastro")} d={SE_VA.d} pathLength={1} fill="none" stroke="#9aa3c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1 }} />
      <path ref={r("regreso")} d={VUELVE.d} pathLength={1} fill="none" stroke={SOL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1 }} />
      <path ref={r("aroLocal")} d={ARO_LOCAL} pathLength={1} fill="none" stroke={SOL} strokeWidth="4" strokeLinecap="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1, filter: "drop-shadow(0 0 6px rgb(255 201 40 / 0.6))" }} />

      {/* Rótulos */}
      <Etiqueta x={tu[0]} y={tu[1] - 20} texto="Tu local" tono="blanco" />
      <Etiqueta x={c1[0]} y={c1[1] - 20} texto="Competencia" tono="gris" />
      <Etiqueta x={c2[0]} y={c2[1] - 20} texto="Competencia" tono="gris" />
      <g transform={`translate(0 ${-50})`}>
        <g ref={r("chipCompra")} style={{ opacity: 0 }}>
          <Etiqueta x={tu[0]} y={tu[1]} texto="Compra · $18.000" tono="sol" />
        </g>
        <g ref={r("chipDuda")} style={{ opacity: 0 }}>
          <Etiqueta x={tu[0]} y={tu[1]} texto="¿Volverá?" tono="gris" />
        </g>
        <g ref={r("chipVisita")} style={{ opacity: 0 }}>
          <Etiqueta x={tu[0]} y={tu[1]} texto="+1 visita" tono="sol" />
        </g>
      </g>
      {[
        ["moneda1", c1],
        ["moneda2", c2],
      ].map(([k, p]) => (
        <g key={k as string} transform={`translate(${(p as P)[0].toFixed(1)} ${((p as P)[1] - 50).toFixed(1)})`}>
          <g ref={r(k as string)} style={{ opacity: 0 }}>
            <circle r="13" fill="#2c3450" stroke="#7b84a3" strokeWidth="1.5" />
            <text y="5" textAnchor="middle" fontSize="14" fontWeight="700" fill="#c9cfdf" style={{ fontFamily: "var(--font-text)" }}>
              $
            </text>
          </g>
        </g>
      ))}

      {/* El cliente */}
      <g ref={r("cliente")} style={{ opacity: 0 }}>
        <ellipse rx="9" ry="4" fill="#030720" opacity="0.45" />
        <circle cy="-16" r="13" fill={SOL} opacity="0.22" />
        <circle cy="-16" r="7.5" fill="#ffffff" />
        <circle cy="-16" r="4" fill={SOL} />
      </g>
      {[0, 1, 2, 3].map((k) => (
        <g key={k} ref={r(`orbita${k}`)} style={{ opacity: 0 }}>
          <circle cy="-10" r="9" fill={SOL} opacity="0.22" />
          <circle cy="-10" r="5.5" fill="#ffffff" />
          <circle cy="-10" r="3" fill={SOL} />
        </g>
      ))}
    </svg>
  );
}

// ——— Piezas del celular ———
function Pase({ r }: { r?: (k: string) => (n: Element | null) => void }) {
  return (
    <div className="overflow-hidden rounded-[20px] bg-cobalt text-white shadow-[0_14px_30px_-14px_rgb(6_10_36/0.7)]">
      <div className="px-4 pt-3.5">
        <div className="flex items-center gap-2.5">
          <img src="/logos/el-faro.svg" alt="" className="size-8 rounded-full bg-white p-1" />
          <span className="text-[13px] font-medium">Barbería El Faro</span>
        </div>
        <p className="mt-2 text-[19px] leading-none font-semibold">Club del Faro</p>
        <div className="mt-2.5 flex items-end justify-between leading-tight">
          <div>
            <p className="text-[11px] text-white/85">Cortes</p>
            <p ref={r?.("cuenta")} className="tabular text-[17px] font-medium">
              0/6
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/85">Próximo premio</p>
            <p className="text-[14px] font-medium">Corte gratis</p>
          </div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-6 gap-1.5 bg-[#142fa8] px-4 py-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative flex aspect-square items-center justify-center rounded-full border-[1.5px] border-dashed border-white/60">
            {i === 5 && <Gift className="size-3.5 text-white/80" />}
            <span ref={r?.(`sello${i}`)} className="absolute -inset-[1.5px] flex items-center justify-center rounded-full bg-sun text-coal" style={{ opacity: 0 }}>
              {i === 5 ? <Gift className="size-3.5" /> : <Scissors className="size-3.5" />}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Esquinas({ className }: { className: string }) {
  const base = "absolute size-7 border-[3px]";
  return (
    <div className={`absolute inset-0 ${className}`}>
      <span className={`${base} top-0 left-0 rounded-tl-xl border-r-0 border-b-0`} />
      <span className={`${base} top-0 right-0 rounded-tr-xl border-b-0 border-l-0`} />
      <span className={`${base} bottom-0 left-0 rounded-bl-xl border-t-0 border-r-0`} />
      <span className={`${base} right-0 bottom-0 rounded-br-xl border-t-0 border-l-0`} />
    </div>
  );
}

function Celular({ r }: { r: (k: string) => (n: Element | null) => void }) {
  const pantalla = "absolute inset-0";
  return (
    <div ref={r("telefono")} data-capa className="historia-capa absolute top-[60px] left-[195px] h-[520px] w-[250px] rounded-[46px] bg-gradient-to-br from-[#4a4a5c] via-[#1c1c26] to-[#0c0c14] p-[3px] shadow-[0_40px_70px_-30px_rgb(0_0_0/0.85)]" style={{ opacity: 0 }}>
      <div className="h-full rounded-[43px] bg-black p-[7px]">
        <div className="relative h-full overflow-hidden rounded-[36px] bg-[#f2f2f7] text-coal">
          <div className="absolute top-2.5 left-1/2 z-30 h-[24px] w-[84px] -translate-x-1/2 rounded-full bg-black" />

          {/* A · Cámara apuntando al QR del cartel */}
          <div ref={r("pantallaA")} className={`${pantalla} z-10 bg-gradient-to-b from-[#232a3d] to-[#0d111c] text-white`}>
            <p className="pt-12 text-center text-[13px] text-white/80">Apunta al código QR</p>
            <div className="absolute top-[96px] left-1/2 h-[214px] w-[176px] -translate-x-1/2">
              <div className="absolute inset-[14px] -rotate-3 rounded-2xl bg-white p-3 text-center text-coal shadow-[0_20px_30px_-12px_rgb(0_0_0/0.6)]">
                <div className="flex items-center justify-center gap-1.5">
                  <img src="/logos/el-faro.svg" alt="" className="size-5" />
                  <span className="text-[10px] font-semibold">Barbería El Faro</span>
                </div>
                <QRCodeSVG value="https://lazo.wontex-devs.com" size={104} className="mx-auto mt-2" fgColor="#0e1a52" />
                <p className="mt-1.5 text-[9px] leading-tight text-graphite">Escanea y crea tu tarjeta</p>
              </div>
              <Esquinas className="[&>span]:border-white/80" />
              <div ref={r("esquinasSol")} className="absolute inset-0" style={{ opacity: 0 }}>
                <Esquinas className="[&>span]:border-sun" />
              </div>
              <div ref={r("escaneo")} className="absolute top-2 right-3 left-3 h-[2px] rounded-full bg-sun shadow-[0_0_14px_3px_rgb(255_201_40/0.7)]" style={{ opacity: 0 }} />
            </div>
            <div ref={r("qrListo")} className="absolute inset-x-0 bottom-16 flex justify-center" style={{ opacity: 0 }}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3.5 py-1.5 text-[12px] font-semibold text-coal">
                <Check className="size-3.5" /> QR de Barbería El Faro
              </span>
            </div>
          </div>

          {/* B · Inscripción */}
          <div ref={r("pantallaB")} className={`${pantalla} z-10 px-4 pt-12`} style={{ opacity: 0 }}>
            <div className="flex items-center gap-2">
              <img src="/logos/el-faro.svg" alt="" className="size-8 rounded-full bg-white p-1 ring-1 ring-black/10" />
              <span className="text-[13px] font-medium">Barbería El Faro</span>
            </div>
            <p className="mt-4 text-[21px] leading-tight font-semibold">Crea tu tarjeta</p>
            <p className="mt-1 text-[12px] text-graphite">Tu tarjeta de sellos, sin descargar nada.</p>
            <p className="mt-5 text-[11px] text-graphite">Nombre</p>
            <div className="mt-1 flex h-10 items-center rounded-xl bg-white px-3 text-[14px] ring-1 ring-black/10">
              <span ref={r("nombre")} style={{ clipPath: "inset(0 100% 0 0)" }}>
                Laura
              </span>
            </div>
            <p className="mt-3 text-[11px] text-graphite">Celular</p>
            <div className="mt-1 flex h-10 items-center rounded-xl bg-white px-3 text-[14px] ring-1 ring-black/10">
              <span ref={r("celular")} className="tabular" style={{ clipPath: "inset(0 100% 0 0)" }}>
                300 123 4567
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-graphite">
              <span className="relative flex size-[18px] items-center justify-center rounded-[5px] ring-1 ring-black/20">
                <span ref={r("check")} className="absolute inset-0 flex items-center justify-center rounded-[5px] bg-cobalt text-white" style={{ opacity: 0 }}>
                  <Check className="size-3" />
                </span>
              </span>
              Acepto la política de datos
            </div>
            <div ref={r("btnCrear")} className="mt-6 flex h-11 items-center justify-center rounded-xl bg-cobalt text-[14px] font-semibold text-white">
              Crear mi tarjeta
            </div>
          </div>

          {/* C · Tarjeta creada y guardada en la billetera */}
          <div ref={r("pantallaC")} className={`${pantalla} z-10`} style={{ opacity: 0 }}>
            <div ref={r("wTitulo")} className="absolute top-11 left-4 flex items-center gap-2 text-[18px] font-semibold" style={{ opacity: 0 }}>
              <Wallet className="size-5 text-cobalt" /> Billetera
            </div>
            <p ref={r("creada")} className="absolute top-14 inset-x-0 flex items-center justify-center gap-1.5 text-[14px] font-semibold" style={{ opacity: 0 }}>
              <Check className="size-4 text-cobalt" /> Tu tarjeta está lista
            </p>
            <div ref={r("pila")} className="absolute inset-x-3 top-[86px]" style={{ opacity: 0 }}>
              <div className="h-[60px] rounded-[18px] bg-[#2c3a52]" />
              <div className="-mt-[46px] h-[60px] rounded-[18px] bg-[#d9cdb8]" />
            </div>
            <div ref={r("paseNuevo")} className="absolute inset-x-3 top-[150px]" style={{ opacity: 0 }}>
              <Pase />
            </div>
            <div ref={r("btnWallet")} className="absolute inset-x-4 bottom-10 flex h-11 items-center justify-center gap-2 rounded-full bg-black text-[13px] font-semibold text-white" style={{ opacity: 0 }}>
              <Wallet className="size-4 text-sun" /> Agregar a Google Wallet
            </div>
            <div ref={r("toast")} className="absolute inset-x-4 bottom-8 flex items-center justify-center gap-2 rounded-2xl bg-coal py-3 text-[12px] font-medium text-white" style={{ opacity: 0 }}>
              <Check className="size-4 text-sun" /> Guardada en Google Wallet
            </div>
          </div>

          {/* E · La tarjeta en uso: sellos, aviso y premio */}
          <div ref={r("pantallaE")} className={`${pantalla} z-10 px-3 pt-11`} style={{ opacity: 0 }}>
            <Pase r={r} />
            <div className="mx-auto mt-4 flex size-[88px] items-center justify-center rounded-2xl bg-white text-cobalt ring-1 ring-black/5">
              <Nfc className="size-12" strokeWidth={1.5} />
            </div>
            <p className="mt-2 text-center text-[11px] text-graphite">Acerca tu celular a la etiqueta</p>

            <div ref={r("aviso")} className="absolute inset-x-2 top-9 z-20 flex items-center gap-2.5 rounded-[18px] bg-white/95 p-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.18)]" style={{ opacity: 0 }}>
              <img src="/logos/el-faro.svg" alt="" className="size-9 shrink-0 rounded-xl bg-white p-1 ring-1 ring-black/10" />
              <div className="min-w-0 leading-snug">
                <p className="flex justify-between gap-2 text-[10px] text-[#5c5c60]">
                  <span>Barbería El Faro</span>
                  <span>ahora</span>
                </p>
                <p className="text-[12px] font-semibold">Sello registrado</p>
                <p className="text-[11px] text-[#3c3c43]">Vas 1 de 6. ¡Gracias por volver!</p>
              </div>
            </div>

            <div ref={r("premio")} className="absolute inset-x-3 bottom-4 z-20 rounded-[20px] bg-sun p-4 text-coal shadow-[0_18px_30px_-14px_rgb(6_10_36/0.6)]" style={{ opacity: 0 }}>
              <div className="relative flex items-center gap-3">
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-coal text-sun">
                  <Gift className="size-5" />
                  <span className="absolute top-1/2 left-1/2">
                    {Array.from({ length: 10 }, (_, k) => (
                      <span key={k} ref={r(`chispa${k}`)} className={`absolute -top-[3px] -left-[3px] size-1.5 rounded-full ${k % 2 ? "bg-cobalt" : "bg-coal"}`} style={{ opacity: 0 }} />
                    ))}
                  </span>
                </span>
                <div className="leading-tight">
                  <p className="text-[16px] font-bold">¡Premio listo!</p>
                  <p className="mt-0.5 text-[12px]">Corte gratis. Muéstralo en caja.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mostrador({ r }: { r: (k: string) => (n: Element | null) => void }) {
  return (
    <div ref={r("mostrador")} data-capa className="historia-capa absolute top-[395px] left-[100px] h-[230px] w-[440px] rounded-[28px] bg-gradient-to-b from-[#f4f6ff] to-[#c7d0f0] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]" style={{ opacity: 0 }}>
      <div className="absolute top-1/2 left-1/2 size-[92px] -translate-x-1/2 -translate-y-1/2">
        <div ref={r("etiquetaLuz")} className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(255_201_40/0.7),transparent)]" style={{ opacity: 0 }} />
        {[0, 1, 2].map((k) => (
          <span key={k} ref={r(`anillo${k}`)} className="absolute inset-0 rounded-full border-[3px] border-sun" style={{ opacity: 0 }} />
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[22px] bg-white text-cobalt shadow-[0_8px_16px_-6px_rgb(14_26_82/0.5)]">
          <Nfc className="size-10" strokeWidth={1.6} />
          <LazoMark className="mt-1 h-3.5 w-3.5 text-sun" />
        </div>
      </div>
    </div>
  );
}

function Panel({ r }: { r: (k: string) => (n: Element | null) => void }) {
  return (
    <div ref={r("panel")} data-capa className="historia-capa absolute top-[100px] left-[30px] h-[440px] w-[580px] overflow-hidden rounded-2xl bg-white text-coal shadow-[0_50px_90px_-30px_rgb(0_0_0/0.8)]" style={{ opacity: 0 }}>
      <div className="flex h-9 items-center gap-1.5 border-b border-coal/10 bg-[#f6f7fb] px-4">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[12px] text-graphite">Panel · Barbería El Faro</span>
      </div>
      <div className="flex h-[calc(100%-36px)]">
        <div className="flex w-14 flex-col items-center gap-5 bg-coal py-4 text-white/60">
          <LazoMark className="h-6 w-6 text-sun" />
          <Users className="size-5 text-white" />
          <Gift className="size-5" />
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1 p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[17px] font-semibold">Así va tu negocio</p>
            <span className="text-[11px] text-graphite">Datos de ejemplo</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {KPIS.map(([, , etiqueta], k) => (
              <div key={etiqueta} className="rounded-xl bg-[#eef1fd] p-3">
                <p ref={r(`kpi${k}`)} className="tabular font-[family-name:var(--font-poster)] text-[24px] leading-none font-extrabold text-cobalt">
                  0
                </p>
                <p className="mt-1.5 text-[11px] leading-tight text-graphite">{etiqueta}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-3">
            <div className="rounded-xl border border-coal/10 p-3">
              <p className="text-[12px] font-semibold">Visitas por semana</p>
              <svg viewBox="-4 -4 258 108" className="mt-2 h-[118px] w-full overflow-visible">
                <path ref={r("area")} d={`${LINEA}L250 100L0 100Z`} fill="#1b3fd8" fillOpacity="0.12" style={{ opacity: 0 }} />
                <path ref={r("linea")} d={LINEA} pathLength={1} fill="none" stroke="#1b3fd8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1 }} />
              </svg>
            </div>
            <div className="rounded-xl border border-coal/10 p-3">
              <p className="text-[12px] font-semibold">A quién avisarle hoy</p>
              <ul className="mt-2 space-y-2">
                {AVISOS.map(([ini, nombre, motivo], k) => (
                  <li key={nombre} ref={r(`fila${k}`)} className="flex items-center gap-2" style={{ opacity: 0 }}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cobalt text-[10px] font-semibold text-white">{ini}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[11px] font-semibold">{nombre}</span>
                      <span className="block truncate text-[10px] text-graphite">{motivo}</span>
                    </span>
                    <span className="rounded-full bg-sun px-2 py-1 text-[10px] font-semibold">Avisar</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** La historia completa: un cliente que se iba y, con Lazo, vuelve. */
export function HistoriaLazo() {
  const seccion = useRef<HTMLElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const piezas = useRef<Mapa>({});
  const llamadas = useRef(new Map<string, (n: Element | null) => void>());
  const [escena, setEscena] = useState(0);

  /** Registra una pieza animada por su nombre (la misma función en cada render). */
  const r = (k: string) => {
    let f = llamadas.current.get(k);
    if (!f) {
      f = (n: Element | null) => {
        if (n) piezas.current[k] = n as HTMLElement | SVGElement;
        else delete piezas.current[k];
      };
      llamadas.current.set(k, f);
    }
    return f;
  };

  useEffect(() => {
    const sec = seccion.current;
    const lz = lienzo.current;
    const cj = caja.current;
    if (!sec || !lz || !cj) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
    let actual = -1;
    let cuadro = 0;
    let ultima = -1;

    const objetivo = () => {
      const rect = sec.getBoundingClientRect();
      const recorrido = rect.height - window.innerHeight;
      return recorrido > 0 ? lim(-rect.top / recorrido) * N : 0;
    };
    const pintar = (T: number) => {
      aplicar(piezas.current, T);
      const e = Math.min(N - 1, Math.floor(T));
      if (e !== ultima) {
        ultima = e;
        setEscena(e);
      }
    };
    const paso = () => {
      cuadro = 0;
      const meta = objetivo();
      if (quieto.matches) {
        const e = Math.min(N - 1, Math.floor(meta));
        if (actual !== QUIETO[e]) {
          actual = QUIETO[e];
          pintar(actual);
        }
        return;
      }
      actual = actual < 0 ? meta : actual + (meta - actual) * 0.14;
      if (Math.abs(meta - actual) < 0.002) actual = meta;
      pintar(actual);
      if (actual !== meta) cuadro = requestAnimationFrame(paso);
    };
    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(paso);
    };
    const escalar = () => {
      const { width, height } = lz.getBoundingClientRect();
      // El contenido útil mide 600 de ancho (el panel); así en celular se aprovecha mejor la pantalla.
      cj.style.transform = `translate(-50%, -50%) scale(${Math.min(width / 600, height / 640).toFixed(4)})`;
    };
    const cambiaModo = () => {
      sec.toggleAttribute("data-quieto", quieto.matches);
      actual = -1;
      pedir();
    };

    const ro = new ResizeObserver(() => {
      escalar();
      pedir();
    });
    ro.observe(lz);
    escalar();
    cambiaModo();
    window.addEventListener("scroll", pedir, { passive: true });
    quieto.addEventListener("change", cambiaModo);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", pedir);
      quieto.removeEventListener("change", cambiaModo);
      cancelAnimationFrame(cuadro);
    };
  }, []);

  return (
    <section ref={seccion} aria-labelledby="historia-titulo" className="historia relative bg-[#0a1240] text-white" style={{ height: "640svh" }}>
      <ol className="sr-only">
        {ESCENAS.map(([t, d]) => (
          <li key={t}>
            {t} {d}
          </li>
        ))}
      </ol>
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden pt-[109px] sm:pt-[125px] lg:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,#2340c9_0%,#13227a_38%,#0a1240_75%)]" />
        <div className="relative mx-auto grid h-full min-h-0 w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-2 px-4 pt-5 pb-4 sm:px-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:grid-rows-1 lg:items-center lg:gap-12 lg:py-10">
          <div>
            <h2 id="historia-titulo" className="text-sm font-semibold text-sun sm:text-base">
              Cómo Lazo hace que tus clientes vuelvan
            </h2>
            <div aria-hidden className="relative mt-3 min-h-[8.5rem] sm:min-h-[10rem] lg:mt-6 lg:min-h-[17rem]">
              {ESCENAS.map(([t, d], k) => (
                <div key={t} className="historia-texto absolute inset-x-0 top-0" data-activo={k === escena || undefined}>
                  <p className="tabular text-sm font-semibold text-white/60">
                    {String(k + 1).padStart(2, "0")} / {N}
                  </p>
                  <p className="mt-1.5 font-[family-name:var(--font-poster)] text-[1.75rem] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance sm:text-4xl lg:mt-3 lg:text-[3.25rem]">{t}</p>
                  <p className="mt-2 max-w-md text-[15px] leading-snug text-white/80 sm:text-lg lg:mt-5 lg:text-xl lg:leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-4 lg:mt-8">
              <div aria-hidden className="flex flex-1 gap-1">
                {ESCENAS.map(([t], k) => (
                  <span key={t} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span ref={r(`barra${k}`)} className="block h-full origin-left rounded-full bg-sun" style={{ transform: "scaleX(0)" }} />
                  </span>
                ))}
              </div>
              <a href="#como-funciona" className="shrink-0 text-sm font-medium text-white/75 underline-offset-4 hover:text-white hover:underline">
                Saltar la historia
              </a>
            </div>
          </div>

          <div ref={lienzo} aria-hidden className="relative h-full min-h-0">
            <div ref={caja} className="historia-caja absolute top-1/2 left-1/2 h-[640px] w-[640px]" style={{ transform: "translate(-50%, -50%) scale(0.5)" }}>
              <div ref={r("mapa")} data-capa className="historia-capa historia-mapa absolute inset-0">
                <Calle r={r} />
              </div>
              <svg ref={r("marca")} data-capa viewBox="-5 -5 70 74" className="historia-capa absolute top-[190px] left-[215px] h-[224px] w-[210px] overflow-visible" style={{ opacity: 0 }} fill="none">
                <path ref={r("marcaTrazo")} d={ARO_LAZO} pathLength={1} stroke={SOL} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1, filter: "drop-shadow(0 0 5px rgb(255 201 40 / 0.65))" }} />
              </svg>
              <Mostrador r={r} />
              <div aria-hidden className="pointer-events-none absolute top-[120px] left-[120px] size-[400px] rounded-full bg-[radial-gradient(closest-side,rgb(90_120_255/0.35),transparent)]" />
              <Celular r={r} />
              <Panel r={r} />
              <div ref={r("cierre")} data-capa className="historia-capa absolute inset-x-0 bottom-[30px] flex flex-col items-center text-center" style={{ opacity: 0 }}>
                <LazoLogo className="text-[64px] text-white" markClassName="text-sun" />
                <p className="mt-3 text-[20px] text-white/85">Clientes que vuelven.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
