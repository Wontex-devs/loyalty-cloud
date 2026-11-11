"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

const CONTORNO = "#0e1a52";
const AZUL = "#1b3fd8";
const SOL = "#ffc928";
const CUERDA = "#c98a2b";
const GRIS = "#9aa3b5";
const POSTER = "var(--font-poster)";

/** Nudo de perfil, mirando hacia la calle. El cuerpo y las manos se mueven por separado para que no suelte la cuerda. */
function Nudo() {
  return (
    <svg x="34" y="172" width="128" height="110" viewBox="0 0 140 120" overflow="visible">
      <g stroke={CONTORNO} strokeWidth="3.5">
        <ellipse cx="44" cy="110" rx="11" ry="6" fill="#e8a900" />
        <ellipse cx="78" cy="110" rx="11" ry="6" fill="#e8a900" />
      </g>
      <g className="nudo-jala">
        <g stroke={CONTORNO} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="58" cy="68" r="33" fill={SOL} />
          <path d="M34 87Q58 99 82 87" fill="none" stroke="#e8a900" />
          <path d="M82 54C94 51 105 55 108 60C98 64 86 62 78 59Z" fill={AZUL} />
          <path d="M27 56C27 27 89 27 89 56C70 50 46 50 27 56Z" fill="#fff" />
          <circle cx="58" cy="34" r="3" fill={AZUL} />
        </g>
        <g fill="none" stroke={CONTORNO} strokeWidth="4" strokeLinecap="round">
          <path d="M51 60L62 63" />
          <path d="M72 63L83 60" />
        </g>
        <g className="nudo-ojos">
          <ellipse cx="57" cy="70" rx="4" ry="5" fill={CONTORNO} />
          <ellipse cx="78" cy="70" rx="4" ry="5" fill={CONTORNO} />
          <circle cx="58.2" cy="68" r="1.4" fill="#fff" />
          <circle cx="79.2" cy="68" r="1.4" fill="#fff" />
        </g>
        <path d="M59 84Q68 90 78 81" fill="none" stroke={CONTORNO} strokeWidth="3.2" strokeLinecap="round" />
      </g>
      <g className="nudo-manos">
        <g fill="none" strokeLinecap="round">
          <path d="M84 80C90 79 96 78 101 77" stroke={CONTORNO} strokeWidth="11" />
          <path d="M84 80C90 79 96 78 101 77" stroke={SOL} strokeWidth="4.5" />
        </g>
        <circle cx="104" cy="77" r="7" fill={SOL} stroke={CONTORNO} strokeWidth="3.5" />
      </g>
    </svg>
  );
}

function Toldo({ x, n, a, b }: { x: number; n: number; a: string; b: string }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${x + 44 * i} 70h44v28a22 12 0 0 1-44 0Z`} fill={i % 2 ? b : a} />
      ))}
    </>
  );
}

function Letrero({ x, ancho, color, texto, tamano }: { x: number; ancho: number; color: string; texto: string; tamano: number }) {
  return (
    <>
      <rect x={x} y="24" width={ancho} height="46" rx="10" fill={color} />
      <text x={x + ancho / 2} y="56" textAnchor="middle" fontFamily={POSTER} fontWeight="800" fontSize={tamano} fill="#fff" stroke="none">
        {texto}
      </text>
    </>
  );
}

function TuLocal() {
  return (
    <g stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round">
      <rect x="16" y="92" width="288" height="188" fill="#fff" />
      <rect x="40" y="124" width="130" height="44" rx="4" fill="#cfdcff" />
      <Letrero x={60} ancho={200} color={AZUL} texto="TU LOCAL" tamano={25} />
      <Toldo x={6} n={7} a={AZUL} b="#fff" />
      <rect x="204" y="164" width="64" height="116" fill={CONTORNO} />
      <g className="escena-puerta">
        <rect x="207" y="167" width="58" height="113" fill={SOL} />
        <circle cx="255" cy="226" r="3.5" fill={CONTORNO} stroke="none" />
      </g>
    </g>
  );
}

function Competencia() {
  return (
    <g stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round">
      <rect x="1096" y="92" width="288" height="188" fill="#eceef3" />
      <rect x="1230" y="124" width="130" height="44" rx="4" fill="#d5d9e2" />
      <Letrero x={1130} ancho={220} color={GRIS} texto="LA COMPETENCIA" tamano={21} />
      <Toldo x={1086} n={7} a={GRIS} b="#eceef3" />
      <rect x="1116" y="164" width="64" height="116" fill={CONTORNO} />
      <rect x="1119" y="167" width="58" height="113" fill="#c3c9d6" />
      <circle cx="1167" cy="226" r="3.5" fill={CONTORNO} stroke="none" />
    </g>
  );
}

function Arbol({ x }: { x: number }) {
  return (
    <g stroke={CONTORNO} strokeWidth="3.5">
      <rect x={x - 6} y="214" width="12" height="66" fill="#a9772f" />
      <circle cx={x} cy="190" r="40" fill="#7fc8a0" />
      <circle cx={x + 26} cy="208" r="24" fill="#7fc8a0" />
    </g>
  );
}

function Nube({ x, y, clase }: { x: number; y: number; clase: string }) {
  return (
    <g className={clase}>
      <path d={`M${x} ${y}a20 20 0 0 1 36-12a26 26 0 0 1 48 8a16 16 0 0 1-4 30h-74a16 16 0 0 1-6-26Z`} fill="#fff" stroke={CONTORNO} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

function Cliente() {
  return (
    <g transform="translate(235 0)">
      <g className="escena-cliente">
        <g className="escena-cliente-ve">
          <g className="escena-polvo" fill="#fff" stroke={CONTORNO} strokeWidth="2.5">
            <circle cx="24" cy="274" r="6" />
            <circle cx="38" cy="268" r="8" />
            <circle cx="54" cy="275" r="5" />
          </g>
          <g className="escena-cliente-tira" stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
            <rect className="escena-pierna-a" x="-10" y="256" width="9" height="24" rx="4" fill={CONTORNO} />
            <rect className="escena-pierna-b" x="1" y="256" width="9" height="24" rx="4" fill={CONTORNO} />
            <rect x="-15" y="222" width="30" height="38" rx="10" fill="#ff7a66" />
            <circle cx="0" cy="206" r="15" fill="#f4c7a1" />
            <path d="M-15 204C-15 186 15 186 15 200C5 197-6 197-15 204Z" fill="#5b3a29" />
            <circle cx="4" cy="207" r="2" fill={CONTORNO} stroke="none" />
            <circle cx="11" cy="207" r="2" fill={CONTORNO} stroke="none" />
            <path className="escena-serio" d="M3 214H11" fill="none" strokeWidth="2.4" />
            <path className="escena-feliz" d="M2 213Q7 219 12 213" fill="none" strokeWidth="2.4" />
            <text className="escena-alerta" x="0" y="184" textAnchor="middle" fontFamily={POSTER} fontWeight="800" fontSize="26" fill={AZUL} stroke="none">
              !
            </text>
          </g>
        </g>
      </g>
    </g>
  );
}

const CORAZON = "M0 6C-7-3-14 3-9 9L0 18L9 9C14 3 7-3 0 6Z";

/**
 * Escena a todo el ancho: el cliente sale del local y va hacia la competencia; Nudo le lanza el lazo y lo trae de vuelta
 * a tirones. Al entrar suma un sello. En pantallas angostas la cámara sigue al cliente.
 * Todo el movimiento está en globals.css (.escena-*), en una misma línea de tiempo de 12 s.
 */
export function EscenaCliente() {
  const [pausado, setPausado] = useState(false);

  return (
    <div className="escena relative overflow-hidden bg-[#eef1fd]" data-pausado={pausado || undefined}>
      <div className="escena-camara">
        <svg
          viewBox="0 0 1400 320"
          className="escena-svg block"
          role="img"
          aria-label="Un cliente sale del local y camina hacia la competencia. Nudo, la mascota de Lazo, le lanza un lazo y lo trae de vuelta, y el cliente suma un sello."
        >
          <Nube x={420} y={70} clase="escena-nube-a" />
          <Nube x={860} y={50} clase="escena-nube-b" />
          <rect y="280" width="1400" height="40" fill="#dbe2fb" />
          <path d="M0 280H1400" stroke={CONTORNO} strokeWidth="3.5" />
          <Arbol x={470} />
          <Arbol x={850} />
          <TuLocal />
          <Competencia />
          <g className="escena-premio">
            <circle cx="236" cy="136" r="23" fill={SOL} stroke={CONTORNO} strokeWidth="3.5" />
            <text x="236" y="145" textAnchor="middle" fontFamily={POSTER} fontWeight="800" fontSize="24" fill={CONTORNO}>
              +1
            </text>
          </g>
          <g className="escena-corazon" fill="#ff7a66" stroke={CONTORNO} strokeWidth="2.5" strokeLinejoin="round">
            <path transform="translate(276 128)" d={CORAZON} />
            <path transform="translate(196 118) scale(0.75)" d={CORAZON} />
          </g>
          <g className="escena-cuerda">
            <rect x="100" y="238.5" width="100" height="7" fill={CONTORNO} />
            <rect x="100" y="240.5" width="100" height="3" fill={CUERDA} />
          </g>
          <Nudo />
          <Cliente />
          <g className="escena-punta">
            <g className="escena-punta-y">
              <g className="escena-aro">
                <ellipse cx="0" cy="242" rx="21" ry="9" fill="none" stroke={CONTORNO} strokeWidth="7" />
                <ellipse cx="0" cy="242" rx="21" ry="9" fill="none" stroke={CUERDA} strokeWidth="3" />
              </g>
            </g>
          </g>
        </svg>
      </div>
      <div className="escena-globo-se-va absolute top-3 left-1/2 -translate-x-1/2 rounded-2xl border-2 border-coal bg-white px-4 py-1.5 font-[family-name:var(--font-poster)] text-base font-extrabold whitespace-nowrap text-coal sm:top-5 sm:text-2xl">
        Tu cliente se va…
      </div>
      <div className="escena-globo-trae absolute top-3 left-1/2 -translate-x-1/2 rounded-2xl border-2 border-coal bg-white px-4 py-1.5 font-[family-name:var(--font-poster)] text-base font-extrabold whitespace-nowrap text-coal sm:top-5 sm:text-2xl">
        ¡Te traemos al cliente!
      </div>
      <button
        type="button"
        onClick={() => setPausado((p) => !p)}
        className="marquee-boton absolute right-3 bottom-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-cobalt transition-transform duration-150 hover:bg-cobalt/10 active:scale-[0.97]"
      >
        {pausado ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        {pausado ? "Reanudar" : "Pausar"}
      </button>
    </div>
  );
}
