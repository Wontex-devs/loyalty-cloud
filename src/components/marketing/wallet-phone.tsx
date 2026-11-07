"use client";

import { QRCodeSVG } from "qrcode.react";
import { Scissors } from "lucide-react";

const EDGE_LAYERS = 16;

/** iPhone en vista isométrica con la tarjeta de un negocio de ejemplo dentro de Wallet. */
export function WalletPhone() {
  return (
    <div className="iso-scene" role="img" aria-label="iPhone con la tarjeta de sellos de Barbería Norte dentro de Wallet">
      <div className="iso-phone">
        <div aria-hidden className="iso-shadow" />
        {Array.from({ length: EDGE_LAYERS }, (_, i) => (
          <div key={i} aria-hidden className="iso-edge" style={{ transform: `translateZ(${-(i + 1) * 1.5}px)` }} />
        ))}

        <div className="absolute inset-0 rounded-[46px] bg-[#0b1238] p-[9px]">
          <div className="relative h-full overflow-hidden rounded-[38px] bg-[#f2f2f7]">
            <div className="absolute left-1/2 top-2.5 h-6 w-[84px] -translate-x-1/2 rounded-full bg-black" />
            <div className="flex items-center justify-between px-7 pt-3.5 text-[12px] font-semibold text-black">
              <span>9:41</span>
              <span>5G</span>
            </div>
            <p className="px-5 pt-5 text-[26px] font-bold leading-none text-black">Wallet</p>

            {/* Pases guardados detrás */}
            <div className="relative mt-4 px-3">
              <div className="h-11 rounded-t-2xl bg-sun px-4 pt-2.5 text-[12px] font-semibold text-coal">Café de la Esquina</div>
              <div className="-mt-3 h-11 rounded-t-2xl bg-white px-4 pt-2.5 text-[12px] font-semibold text-coal shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">Estudio Lila</div>

              {/* Pase principal */}
              <div className="-mt-3 rounded-2xl bg-cobalt px-4 pb-6 pt-4 text-white shadow-[0_-2px_8px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-sun text-[11px] font-bold text-coal">BN</span>
                    <span className="text-[13px] font-semibold">Barbería Norte</span>
                  </div>
                  <div className="text-right leading-tight">
                    <p className="text-[8px] font-semibold uppercase text-white/70">Sellos</p>
                    <p className="text-[15px] font-semibold">5/6</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={i < 5 ? "flex aspect-square items-center justify-center rounded-full bg-sun text-coal" : "aspect-square rounded-full border-[1.5px] border-dashed border-white/60"}
                    >
                      {i < 5 && <Scissors className="size-3" />}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex justify-between text-[11px] leading-tight">
                  <div>
                    <p className="text-[8px] font-semibold uppercase text-white/70">Cliente</p>
                    <p className="font-medium">Andrés Ruiz</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-semibold uppercase text-white/70">Premio</p>
                    <p className="font-medium">Corte gratis</p>
                  </div>
                </div>

                <div className="mx-auto mt-6 w-fit rounded-lg bg-white p-2.5">
                  <QRCodeSVG value="Ejemplo de tarjeta" size={132} fgColor="#0e1a52" />
                </div>
                <p className="mt-3 text-center text-[11px] text-white/85">Muestra este código en caja</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
