import { cn } from "@/lib/utils";

/** Nudo trébol de un solo trazo; en cada cruce la hebra de abajo se interrumpe, así se ve cuál pasa por encima. Cuadro de 64 × 64. */
const NUDO =
  "M50.8 34.5 L51.6 35.3 L52.4 36.3 L53.1 37.2 L53.7 38.2 L54.2 39.2 L54.7 40.1 L55.0 41.1 L55.3 42.1 L55.4 43.1 L55.5 44.1 L55.5 45.0 L55.4 46.0 L55.2 46.9 L54.9 47.7 L54.5 48.5 L54.1 49.3 L53.5 50.0 L52.9 50.7 L52.2 51.3 L51.5 51.9 L50.7 52.4 L49.8 52.8 L48.9 53.1 L47.9 53.4 L46.8 53.6 L45.8 53.7 L44.7 53.7 L43.5 53.7 L42.3 53.6 L41.2 53.3 L40.0 53.0 L38.8 52.7 L37.5 52.2 L36.3 51.6 L35.1 51.0 L34.0 50.3 L32.8 49.5 L31.7 48.7 L30.6 47.7 L29.5 46.7 L28.5 45.7 L27.5 44.6 L26.6 43.4 L25.7 42.2 L24.9 40.9 L24.2 39.6 L23.5 38.3 M21.3 20.6 L21.6 19.4 L22.0 18.2 L22.5 17.2 L23.0 16.2 L23.6 15.2 L24.2 14.3 L24.9 13.6 L25.7 12.8 L26.4 12.2 L27.2 11.7 L28.1 11.2 L28.9 10.8 L29.8 10.5 L30.7 10.4 L31.6 10.3 L32.5 10.3 L33.4 10.4 L34.3 10.6 L35.1 10.8 L36.0 11.2 L36.8 11.7 L37.6 12.2 L38.4 12.9 L39.1 13.6 L39.8 14.4 L40.4 15.3 L41.0 16.2 L41.5 17.2 L42.0 18.3 L42.4 19.4 L42.8 20.6 L43.0 21.9 L43.2 23.1 L43.3 24.5 L43.4 25.8 L43.4 27.2 L43.3 28.6 L43.1 30.0 L42.8 31.4 L42.5 32.8 L42.1 34.2 L41.6 35.6 L41.1 37.0 L40.5 38.4 L39.8 39.7 L39.0 41.0 L38.2 42.3 M24.0 53.1 L22.8 53.4 L21.6 53.6 L20.4 53.7 L19.3 53.7 L18.2 53.7 L17.1 53.6 L16.1 53.4 L15.1 53.1 L14.2 52.8 L13.3 52.3 L12.5 51.9 L11.7 51.3 L11.0 50.7 L10.4 50.0 L9.9 49.3 L9.5 48.5 L9.1 47.7 L8.8 46.8 L8.6 45.9 L8.5 45.0 L8.5 44.0 L8.6 43.1 L8.8 42.1 L9.0 41.1 L9.4 40.1 L9.8 39.1 L10.3 38.1 L10.9 37.2 L11.6 36.2 L12.4 35.3 L13.3 34.4 L14.2 33.6 L15.2 32.7 L16.3 32.0 L17.5 31.3 L18.7 30.6 L19.9 30.0 L21.2 29.4 L22.6 28.9 L24.0 28.5 L25.4 28.2 L26.8 27.9 L28.3 27.7 L29.8 27.5 L31.3 27.4 L32.8 27.4 L34.3 27.5 M50.8 34.5";

/**
 * Marca de Lazo: un nudo trébol. Usa el color del texto (`currentColor`).
 * Con `sello`, lleva alrededor el borde de puntos de una tarjeta de sellos (solo para tamaños grandes).
 * Con `animar`, el nudo se dibuja una sola vez al cargar (se omite si la persona pidió menos movimiento).
 */
export function LazoMark({ className, animar = false, sello = false }: { className?: string; animar?: boolean; sello?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("shrink-0", animar && "lazo-dibuja", className)} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {sello && <circle cx="32" cy="32" r="30" strokeWidth="2.4" strokeOpacity="0.55" strokeDasharray="0.1 7.7" />}
      <path className="lazo-trazo" pathLength={1} d={NUDO} strokeWidth="6.4" />
    </svg>
  );
}

/** Marca + nombre «Lazo». El color del texto da el color de la palabra; la marca va en `markClassName`. */
export function LazoLogo({
  className,
  markClassName,
  animar = false,
}: {
  className?: string;
  markClassName?: string;
  animar?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-[family-name:var(--font-poster)] text-2xl font-extrabold tracking-[-0.02em]", className)}>
      <LazoMark animar={animar} className={cn("size-8", markClassName)} />
      Lazo
    </span>
  );
}
