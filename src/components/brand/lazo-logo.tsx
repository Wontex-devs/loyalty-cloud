import { cn } from "@/lib/utils";

/** La «o» de Lazo: un aro de cuerda, de un solo trazo: una cola corta a la altura del aro (más alta se leería como «d»). Cuadro de 60 × 64; el aro apoya en el borde inferior. */
const ARO = "M53 25C50 32 43 34 34 35A16.5 14 0 1 0 10 55A16.5 14 0 1 0 34 35";

/**
 * El aro de Lazo, solo, para espacios pequeños. Usa el color del texto (`currentColor`).
 * Con `animar`, se dibuja una sola vez al cargar (se omite si la persona pidió menos movimiento).
 */
export function LazoMark({ className, animar = false }: { className?: string; animar?: boolean }) {
  return (
    <svg viewBox="0 0 60 64" aria-hidden className={cn("shrink-0", animar && "lazo-dibuja", className)} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path className="lazo-trazo" pathLength={1} d={ARO} strokeWidth="10" />
    </svg>
  );
}

/** Logotipo: la palabra Lazo con el aro como «o». El color del texto da el de las letras; el aro va en `markClassName`. */
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
    <span role="img" aria-label="Lazo" className={cn("inline-flex items-baseline font-[family-name:var(--font-poster)] leading-none font-extrabold tracking-[-0.02em]", className)}>
      <span aria-hidden>Laz</span>
      <LazoMark animar={animar} className={cn("ml-[0.03em] h-[1em] w-[0.9375em]", markClassName)} />
    </span>
  );
}
