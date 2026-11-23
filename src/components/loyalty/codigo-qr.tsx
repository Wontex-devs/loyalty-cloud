import { QRCodeSVG } from "qrcode.react";
import { codigoLegible, esCodigoTarjeta } from "@/lib/domain/code128";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/config";
import { enlaceDeSello } from "@/lib/domain/enlace-sello";

/**
 * Código QR de la tarjeta, igual al que dibujan Apple Wallet y Google Wallet al pie del pase.
 * Lleva un enlace con el número de 12 dígitos (…/sello/número): el panel lo lee y, además, la cámara normal
 * del celular de quien atiende lo abre y suma el sello. Con corrección «L» el QR queda de 29 × 29 cuadros,
 * todavía grandes y fáciles de leer.
 * Negro sobre blanco y con margen, y el número debajo por si hay que escribirlo.
 */
export function CodigoQr({ codigo, className }: { codigo: string; className?: string }) {
  if (!esCodigoTarjeta(codigo)) return null;
  return (
    <div className={cn("mx-auto w-fit rounded-xl bg-white px-4 pt-4 pb-2 text-center text-[#111111]", className)}>
      <QRCodeSVG value={enlaceDeSello(codigo, SITE_URL)} size={132} level="L" marginSize={0} bgColor="#ffffff" fgColor="#111111" role="img" aria-label={`Código QR ${codigoLegible(codigo)}`} className="mx-auto block" />
      <p className="mt-2 font-mono text-[12px] tracking-[0.18em] tabular-nums">{codigoLegible(codigo)}</p>
    </div>
  );
}
