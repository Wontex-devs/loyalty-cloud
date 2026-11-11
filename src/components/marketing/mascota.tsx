"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const FRASES = [
  "¡Hola! Soy Nudo.",
  "Yo ayudo a que tus clientes vuelvan.",
  "Un toque con el celular y el sello queda listo.",
  "Sin apps que descargar: tu tarjeta va en el celular.",
  "¿Ya eres cliente? Entra por el botón de arriba.",
];

const CLAVE_OCULTO = "lazo:nudo:oculto";
const CONTORNO = "#0e1a52";
const CUERDA = "#c98a2b";

/** Dibujo de Nudo: un muchacho redondo con gorra que hace girar su lazo. Las clases de movimiento están en globals.css. */
export function NudoDibujo() {
  return (
    <svg viewBox="0 0 120 120" className="size-full overflow-visible" aria-hidden>
      <g className="nudo-brazo" fill="none" strokeLinecap="round">
        <path d="M86 72C96 66 102 58 104 48" stroke={CONTORNO} strokeWidth="11" />
        <path d="M86 72C96 66 102 58 104 48" stroke="#ffc928" strokeWidth="4.5" />
        <path d="M104 44V25" stroke={CONTORNO} strokeWidth="6.5" />
        <path d="M104 44V25" stroke={CUERDA} strokeWidth="3" />
        <ellipse cx="104" cy="18" rx="20" ry="7" stroke={CONTORNO} strokeWidth="6.5" />
        <ellipse cx="104" cy="18" rx="20" ry="7" stroke={CUERDA} strokeWidth="3" />
        <ellipse className="nudo-giro" cx="104" cy="18" rx="20" ry="7" stroke="#fff" strokeWidth="3" pathLength="100" strokeDasharray="16 84" />
        <circle cx="104" cy="46" r="6" fill="#ffc928" stroke={CONTORNO} strokeWidth="3.5" />
      </g>
      <g stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="48" cy="107" rx="10" ry="6" fill="#e8a900" />
        <ellipse cx="72" cy="107" rx="10" ry="6" fill="#e8a900" />
        <circle cx="60" cy="70" r="33" fill="#ffc928" />
        <path d="M36 89Q60 101 84 89" fill="none" stroke="#e8a900" />
      </g>
      <g fill="none" strokeLinecap="round">
        <path d="M34 76C26 80 24 88 28 93" stroke={CONTORNO} strokeWidth="11" />
        <path d="M34 76C26 80 24 88 28 93" stroke="#ffc928" strokeWidth="4.5" />
      </g>
      <g stroke={CONTORNO} strokeWidth="3.5" strokeLinejoin="round">
        <path d="M36 57C24 54 13 58 10 63C20 67 32 65 40 62Z" fill="#1b3fd8" />
        <path d="M29 59C29 30 91 30 91 59C72 53 48 53 29 59Z" fill="#fff" />
        <circle cx="60" cy="37" r="3" fill="#1b3fd8" />
      </g>
      <g fill="none" stroke={CONTORNO} strokeWidth="4" strokeLinecap="round">
        <path d="M43 62L54 64" />
        <path d="M66 64L77 62" />
      </g>
      <g className="nudo-ojos">
        <ellipse cx="49" cy="72" rx="4" ry="5" fill={CONTORNO} />
        <ellipse cx="71" cy="72" rx="4" ry="5" fill={CONTORNO} />
        <circle cx="50.2" cy="70" r="1.4" fill="#fff" />
        <circle cx="72.2" cy="70" r="1.4" fill="#fff" />
      </g>
      <path d="M50 84Q61 91 71 82" fill="none" stroke={CONTORNO} strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Nudo, la mascota de Lazo: flota en la esquina de la portada y dice frases cortas de vez en cuando.
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

  // En celular, Nudo no habla hasta que la persona baja de la portada: así su globo no tapa el texto principal.
  const [hablar, setHablar] = useState(false);
  useEffect(() => {
    if (!montado) return;
    if (window.matchMedia("(min-width: 640px)").matches || window.scrollY > 500) {
      setHablar(true);
      return;
    }
    const alBajar = () => {
      if (window.scrollY > 500) setHablar(true);
    };
    window.addEventListener("scroll", alBajar, { passive: true });
    return () => window.removeEventListener("scroll", alBajar);
  }, [montado]);

  useEffect(() => {
    if (!montado || !hablar) return;
    const espera = bocadillo ? 6500 : frase < 0 ? 1600 : 9000;
    const t = setTimeout(() => {
      if (bocadillo) setBocadillo(false);
      else {
        setFrase((f) => (f + 1) % FRASES.length);
        setBocadillo(true);
      }
    }, espera);
    return () => clearTimeout(t);
  }, [montado, hablar, bocadillo, frase, pulso]);

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
    <div className="nudo pointer-events-none fixed right-3 bottom-3 z-30 flex items-end gap-1 sm:right-6 sm:bottom-6">
      {bocadillo && frase >= 0 && (
        <p
          key={frase}
          className="animate-fade-up relative mb-14 max-w-[190px] rounded-2xl border-2 border-coal bg-white px-3.5 py-2.5 text-sm leading-snug font-semibold text-coal shadow-[0_10px_24px_-14px_rgb(6_10_36/0.7)] sm:max-w-[230px] sm:text-[15px]"
        >
          {FRASES[frase]}
          <span aria-hidden className="absolute -right-[7px] bottom-4 size-3 rotate-45 border-t-2 border-r-2 border-coal bg-white" />
        </p>
      )}
      <div className="pointer-events-auto relative size-20 shrink-0 sm:size-28">
        <button
          type="button"
          onClick={tocar}
          aria-label="Nudo, la mascota de Lazo. Tócalo para que diga otra cosa"
          className="nudo-boton block size-full cursor-pointer"
        >
          <span className="nudo-salto block size-full" data-saltando={saltando || undefined} onAnimationEnd={() => setSaltando(false)}>
            <span className="nudo-flota block size-full">
              <NudoDibujo />
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Ocultar a Nudo"
          className="absolute bottom-0 -left-1 flex size-6 items-center justify-center rounded-full border-2 border-coal bg-white text-coal"
        >
          <X className="size-3.5" strokeWidth={3} aria-hidden />
        </button>
      </div>
    </div>
  );
}
