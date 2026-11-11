const CONTORNO = "#0e1a52";

/** Nudo de perfil, echado hacia atrás mientras jala. El movimiento está en globals.css (.nudo-*). */
function Dibujo() {
  return (
    <svg viewBox="0 0 140 120" className="size-full overflow-visible" aria-hidden>
      <ellipse cx="62" cy="116" rx="40" ry="4" fill={CONTORNO} opacity="0.12" />
      <g stroke={CONTORNO} strokeWidth="3.5">
        <ellipse cx="44" cy="110" rx="11" ry="6" fill="#e8a900" />
        <ellipse cx="78" cy="110" rx="11" ry="6" fill="#e8a900" />
      </g>
      <g className="nudo-jala">
        <g stroke={CONTORNO} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="58" cy="68" r="33" fill="#ffc928" />
          <path d="M34 87Q58 99 82 87" fill="none" stroke="#e8a900" />
          <path d="M82 54C94 51 105 55 108 60C98 64 86 62 78 59Z" fill="#1b3fd8" />
          <path d="M27 56C27 27 89 27 89 56C70 50 46 50 27 56Z" fill="#fff" />
          <circle cx="58" cy="34" r="3" fill="#1b3fd8" />
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
        <g fill="none" strokeLinecap="round">
          <path d="M84 80C90 79 96 78 101 77" stroke={CONTORNO} strokeWidth="11" />
          <path d="M84 80C90 79 96 78 101 77" stroke="#ffc928" strokeWidth="4.5" />
        </g>
        <circle cx="104" cy="77" r="7" fill="#ffc928" stroke={CONTORNO} strokeWidth="3.5" />
      </g>
    </svg>
  );
}

/**
 * Nudo jalando la fila de tarjetas con su lazo: es parte del diseño de la sección de marcas.
 * Va dentro de un contenedor con position: relative; la cuerda llega hasta las tarjetas (ver brand-preview.tsx).
 */
export function NudoJalando() {
  return (
    <>
      <div aria-hidden className="absolute top-[66px] right-0 left-[110px] z-10 h-2 overflow-hidden border-y border-coal sm:left-[126px] lg:top-[101px] lg:left-[190px]">
        <div className="nudo-cuerda h-full" />
      </div>
      <div className="absolute top-0 left-4 z-20 h-[110px] w-[128px] sm:left-8 lg:left-12 lg:h-[165px] lg:w-[192px]">
        <Dibujo />
      </div>
      <p className="absolute top-0 left-[150px] z-20 rounded-2xl border-2 border-coal bg-white px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-coal sm:left-[168px] sm:text-base lg:top-6 lg:left-[252px] lg:text-lg">
        ¡Te traemos al cliente!
      </p>
    </>
  );
}
