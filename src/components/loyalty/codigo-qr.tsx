import { QRCodeSVG } from "qrcode.react";
import { codigoLegible, esCodigoTarjeta } from "@/lib/domain/code128";
import { cn } from "@/lib/utils";

/**
 * Código QR de la tarjeta, igual al que dibujan Apple Wallet y Google Wallet al pie del pase.
 * Lleva solo el número de 12 dígitos de la tarjeta: con tan pocos datos el QR sale con cuadros
 * grandes (21 × 21), que cualquier cámara lee de inmediato, de lado o inclinado.
 * Negro sobre blanco y con margen, y el número debajo por si hay que escribirlo.
 */
export function CodigoQr({ codigo, className }: { codigo: string; className?: string }) {
  if (!esCodigoTarjeta(codigo)) return null;
  return (
    <div className={cn("mx-auto w-fit rounded-xl bg-white px-4 pt-4 pb-2 text-center text-[#111111]", className)}>
      <QRCodeSVG value={codigo} size={132} level="M" marginSize={0} bgColor="#ffffff" fgColor="#111111" role="img" aria-label={`Código QR ${codigoLegible(codigo)}`} className="mx-auto block" />
      <p className="mt-2 font-mono text-[12px] tracking-[0.18em] tabular-nums">{codigoLegible(codigo)}</p>
    </div>
  );
}
