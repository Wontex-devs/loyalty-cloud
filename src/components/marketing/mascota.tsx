"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const FRASES = [
  "¡Hola! Soy Lacito.",
  "Yo ayudo a que tus clientes vuelvan.",
  "Un toque con el celular y el sello queda listo.",
  "Sin apps que descargar: tu tarjeta va en el celular.",
  "¿Ya eres cliente? Entra por el botón de arriba.",
];

const CLAVE_OCULTO = "lazo:lacito:oculto";
const CONTORNO = "#0e1a52";

/** Dibujo de Lacito: un moño con cara, porque «lazo» también es eso. Las clases de movimiento están en globals.css. */
function Dibujo() {
  return (
    <svg viewBox="0 0 120 120" className="size-full overflow-visible" aria-hidden>
      <g stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        <g className="lacito-cintas">
          <path d="M54 74C50 88 44 98 38 108L50 104L56 112C60 100 62 88 62 76Z" fill="#e8a900" />
          <path d="M66 74C70 88 76 98 82 108L70 104L64 112C60 100 58 88 58 76Z" fill="#e8a900" />
        </g>
        <g className="lacito-ala-izq">
          <path d="M54 50C40 30 14 28 10 46C7 60 12 78 24 80C36 82 46 72 54 66Z" fill="#ffc928" />
          <path d="M44 57C36 51 27 49 21 53" fill="none" stroke="#e8a900" />
        </g>
        <g className="lacito-ala-der">
          <path d="M66 50C80 30 106 28 110 46C113 60 108 78 96 80C84 82 74 72 66 66Z" fill="#ffc928" />
          <path d="M76 57C84 51 93 49 99 53" fill="none" stroke="#e8a900" />
        </g>
        <rect x="38" y="36" width="44" height="44" rx="18" fill="#ffdd66" />
      </g>
      <ellipse cx="45" cy="65" rx="4.2" ry="2.8" fill="#ff9aa2" />
      <ellipse cx="75" cy="65" rx="4.2" ry="2.8" fill="#ff9aa2" />
      <g className="lacito-ojos">
        <ellipse cx="51" cy="56" rx="4" ry="5.2" fill={CONTORNO} />
        <ellipse cx="69" cy="56" rx="4" ry="5.2" fill={CONTORNO} />
        <circle cx="52.3" cy="54" r="1.5" fill="#fff" />
        <circle cx="70.3" cy="54" r="1.5" fill="#fff" />
      </g>
      <path d="M54.5 65.5Q60 71.5 65.5 65.5" fill="none" stroke={CONTORNO} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Lacito, la mascota de Lazo: flota en la esquina de la portada y dice frases cortas de vez en cuando.
 * Al tocarlo salta y cambia de frase. Se puede cerrar y no vuelve durante esa visita.
 */
export function Mascota() {
  const [montado, setMontado] = useState(false);
  const [frase, setFrase] = useState(-1);
  const [bocadillo, setBocadillo] = useState(false);
  const [saltando, setSaltando] = useState(false);
  const [pulso, setPulso] = useState(0);

  useEffect(() => {
    let oculto = false;
    try {
      oculto = sessionStorage.getItem(CLAVE_OCULTO) === "1";
    } catch {
      /* sin almacenamiento: se muestra normal */
    }
    if (!oculto) setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    const espera = bocadillo ? 6500 : frase < 0 ? 1600 : 9000;
    const t = setTimeout(() => {
      if (bocadillo) setBocadillo(false);
      else {
        setFrase((f) => (f + 1) % FRASES.length);
        setBocadillo(true);
      }
    }, espera);
    return () => clearTimeout(t);
  }, [montado, bocadillo, frase, pulso]);

  if (!montado) return null;

  const tocar = () => {
    setFrase((f) => (f + 1) % FRASES.length);
    setBocadillo(true);
    setPulso((p) => p + 1);
    setSaltando(true);
  };

  const cerrar = () => {
    setMontado(false);
    try {
      sessionStorage.setItem(CLAVE_OCULTO, "1");
    } catch {
      /* si no se puede guardar, solo se cierra por ahora */
    }
  };

  return (
    <div className="lacito pointer-events-none fixed right-3 bottom-3 z-30 flex items-end gap-1 sm:right-6 sm:bottom-6">
      {bocadillo && frase >= 0 && (
        <p
          key={frase}
          className="animate-fade-up relative mb-14 max-w-[190px] rounded-2xl border-2 border-coal bg-white px-3.5 py-2.5 text-sm leading-snug font-semibold text-coal shadow-[0_10px_24px_-14px_rgb(6_10_36/0.7)] sm:max-w-[230px] sm:text-[15px]"
        >
          {FRASES[frase]}
          <span aria-hidden className="absolute -right-[7px] bottom-4 size-3 rotate-45 border-t-2 border-r-2 border-coal bg-white" />
        </p>
      )}
      <div className="pointer-events-auto relative size-24 shrink-0 sm:size-28">
        <button
          type="button"
          onClick={tocar}
          aria-label="Lacito, la mascota de Lazo. Tócalo para que diga otra cosa"
          className="lacito-boton block size-full cursor-pointer"
        >
          <span className="lacito-salto block size-full" data-saltando={saltando || undefined} onAnimationEnd={() => setSaltando(false)}>
            <span className="lacito-flota block size-full">
              <Dibujo />
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Ocultar a Lacito"
          className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-coal bg-white text-coal"
        >
          <X className="size-3.5" strokeWidth={3} aria-hidden />
        </button>
      </div>
    </div>
  );
}
