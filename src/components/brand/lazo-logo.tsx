import { cn } from "@/lib/utils";

/** Trazo único: un lazo que se enrolla arriba, baja como el palo de la «L» y se extiende en su base. */
const TRAZO = "M12 10 C22 2 38 8 30 20 C24 29 18 24 22 16 L22 46 C22 52 26 55 32 55 H54";

/**
 * Marca de Lazo: una «L» que se cierra en lazo. Usa el color del texto (`currentColor`).
 * Con `animar`, el trazo se dibuja una sola vez al cargar (se omite si la persona pidió menos movimiento).
 */
export function LazoMark({ className, animar = false }: { className?: string; animar?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("shrink-0", animar && "lazo-dibuja", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="lazo-trazo" pathLength={1} d={TRAZO} transform="translate(-1 1)" />
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
