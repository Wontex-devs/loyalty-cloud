"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

const CONTORNO = "#0e1a52";
const AZUL = "#1b3fd8";
const SOL = "#ffc928";
const CUERDA = "#c98a2b";
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

function Local() {
  return (
    <g stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round">
      <rect x="16" y="92" width="288" height="188" fill="#fff" />
      <rect x="40" y="124" width="130" height="44" rx="4" fill="#cfdcff" />
      <rect x="60" y="24" width="200" height="46" rx="10" fill={AZUL} />
      <text x="160" y="56" textAnchor="middle" fontFamily={POSTER} fontWeight="800" fontSize="25" fill="#fff" stroke="none">
        TU LOCAL
      </text>
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M${6 + 44 * i} 70h44v28a22 12 0 0 1-44 0Z`} fill={i % 2 ? "#fff" : AZUL} />
      ))}
      <rect x="204" y="164" width="64" height="116" fill={CONTORNO} />
      <g className="escena-puerta">
        <rect x="207" y="167" width="58" height="113" fill={SOL} />
        <circle cx="255" cy="226" r="3.5" fill={CONTORNO} stroke="none" />
      </g>
    </g>
  );
}

function Cliente() {
  return (
    <g transform="translate(235 0)">
      <g className="escena-cliente">
        <g className="escena-cliente-ve">
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

function Globo({ clase, x, ancho, texto }: { clase: string; x: number; ancho: number; texto: string }) {
  return (
    <g className={clase}>
      <rect x={x} y="26" width={ancho} height="52" rx="16" fill="#fff" stroke={CONTORNO} strokeWidth="3" />
      <text x={x + ancho / 2} y="60" textAnchor="middle" fontFamily={POSTER} fontWeight="800" fontSize="24" fill={CONTORNO}>
        {texto}
      </text>
    </g>
  );
}

/**
 * El cliente sale del local y se va; Nudo le lanza el lazo y lo trae de vuelta a tirones. Al entrar suma un sello.
 * Todo el movimiento está en globals.css (.escena-*), en una misma línea de tiempo de 9 s.
 */
export function EscenaCliente() {
  const [pausado, setPausado] = useState(false);

  return (
    <div className="mt-12 max-w-4xl">
      <div className="escena overflow-hidden rounded-2xl bg-[#eef1fd]" data-pausado={pausado || undefined}>
        <svg
          viewBox="0 0 640 320"
          className="block h-auto w-full"
          role="img"
          aria-label="Un cliente sale del local y se aleja. Nudo, la mascota de Lazo, le lanza un lazo y lo trae de vuelta, y el cliente suma un sello."
        >
          <rect y="280" width="640" height="40" fill="#dbe2fb" />
          <path d="M0 280H640" stroke={CONTORNO} strokeWidth="3.5" />
          <Local />
          <g className="escena-premio">
            <circle cx="236" cy="136" r="23" fill={SOL} stroke={CONTORNO} strokeWidth="3.5" />
            <text x="236" y="145" textAnchor="middle" fontFamily={POSTER} fontWeight="800" fontSize="24" fill={CONTORNO}>
              +1
            </text>
          </g>
          <g className="escena-cuerda">
            <rect x="100" y="238.5" width="100" height="7" fill={CONTORNO} />
            <rect x="100" y="240.5" width="100" height="3" fill={CUERDA} />
          </g>
          <Nudo />
          <Cliente />
          <g className="escena-punta">
            <ellipse cx="0" cy="242" rx="21" ry="9" fill="none" stroke={CONTORNO} strokeWidth="7" />
            <ellipse cx="0" cy="242" rx="21" ry="9" fill="none" stroke={CUERDA} strokeWidth="3" />
          </g>
          <Globo clase="escena-globo-se-va" x={408} ancho={212} texto="Tu cliente se va…" />
          <Globo clase="escena-globo-trae" x={326} ancho={294} texto="¡Te traemos al cliente!" />
        </svg>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => setPausado((p) => !p)}
          className="marquee-boton inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-cobalt transition-transform duration-150 hover:bg-cobalt/10 active:scale-[0.97]"
        >
          {pausado ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {pausado ? "Reanudar" : "Pausar"}
        </button>
      </div>
    </div>
  );
}
