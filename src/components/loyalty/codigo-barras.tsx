import { barrasCode128, codigoLegible, esCodigoTarjeta } from "@/lib/domain/code128";
import { cn } from "@/lib/utils";

/**
 * Código de barras de la tarjeta, igual al que dibujan Apple Wallet y Google Wallet al pie del pase:
 * barras negras sobre blanco (así lo lee cualquier cámara) y el número debajo, por si hay que escribirlo.
 */
export function CodigoBarras({ codigo, className }: { codigo: string; className?: string }) {
  if (!esCodigoTarjeta(codigo)) return null;
  const { barras, total } = barrasCode128(codigo);
  // Zona en blanco a los lados: sin ella muchos lectores no encuentran el inicio del código.
  const margen = 10;
  return (
    <div className={cn("mx-auto w-full max-w-[300px] rounded-xl bg-white px-3 pt-3 pb-2 text-center text-[#111111]", className)}>
      <svg
        role="img"
        aria-label={`Código de barras ${codigoLegible(codigo)}`}
        viewBox={`${-margen} 0 ${total + margen * 2} 40`}
        preserveAspectRatio="none"
        className="block h-14 w-full"
        shapeRendering="crispEdges"
      >
        {barras.map((b) => (
          <rect key={b.x} x={b.x} y={0} width={b.ancho} height={40} fill="#111111" />
        ))}
      </svg>
      <p className="mt-1 font-mono text-[12px] tracking-[0.18em] tabular-nums">{codigoLegible(codigo)}</p>
    </div>
  );
}
