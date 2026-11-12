"use client";

import { ArrowLeft, Gift, Nfc, Scissors, Wallet } from "lucide-react";

/** Icono genérico de billetera: tarjetas de colores saliendo de un bolsillo. */
function WalletBadge({ name, className }: { name: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-2xl bg-black py-2.5 pl-3 pr-5 text-white shadow-[0_14px_30px_rgba(6,10,36,0.4)] ${className}`}>
      <Wallet className="size-6 shrink-0 text-sun" aria-hidden />
      <p className="leading-tight">
        <span className="block text-xs text-white/80">Funciona con</span>
        <span className="block whitespace-nowrap text-[17px] font-semibold">{name}</span>
      </p>
    </div>
  );
}

/** iPhone flotando: la tarjeta de un negocio de ejemplo y el aviso que le llega al sumar un sello. */
export function WalletPhone() {
  return (
    <div className="phone-frame" role="img" aria-label="iPhone con la tarjeta de sellos de Barbería El Faro: llega un aviso de sello registrado y se marca el quinto sello">
      <div className="phone-scene">
        <div aria-hidden className="phone-shadow" />

        <div className="phone-float absolute left-[70px] top-6 h-[610px] w-[300px] rounded-[50px] bg-gradient-to-br from-[#3a3a48] via-[#1c1c26] to-[#0c0c14] p-[3px]">
          <div className="h-full rounded-[47px] bg-black p-[7px]">
            <div className="relative h-full overflow-hidden rounded-[40px] bg-[#f2f2f7] text-black">
              <div className="absolute left-1/2 top-2.5 z-20 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
              <div className="flex items-center justify-between px-7 pt-3.5 text-[13px] font-semibold">
                <span>9:41</span>
                <span>5G</span>
              </div>
              <ArrowLeft className="ml-5 mt-5 size-5 text-[#3c3c43]" />

              {/* Aviso */}
              <div className="notice-slide absolute inset-x-2.5 top-11 z-10 flex items-center gap-2.5 rounded-[20px] bg-white/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                <img src="/logos/el-faro.svg" alt="" className="size-10 shrink-0 rounded-xl bg-white p-1 ring-1 ring-black/10" />
                <div className="min-w-0 flex-1 leading-snug">
                  <p className="flex justify-between gap-2 text-xs text-[#5c5c60]">
                    <span>Wallet</span>
                    <span>ahora</span>
                  </p>
                  <p className="text-sm font-semibold">Barbería El Faro</p>
                  <p className="text-[13px] text-[#3c3c43]">Sello registrado. Vas 5 de 6.</p>
                </div>
              </div>

              {/* Pase */}
              <div className="absolute inset-x-2.5 bottom-3 top-[124px] overflow-hidden rounded-[22px] bg-cobalt text-white">
                <div className="px-4 pt-3.5">
                  <div className="flex items-center gap-2.5">
                    <img src="/logos/el-faro.svg" alt="" className="size-9 rounded-full bg-white p-1" />
                    <span className="text-sm font-medium">Barbería El Faro</span>
                  </div>
                  <p className="mt-2.5 text-[21px] font-semibold leading-none">Club del Faro</p>
                  <div className="mt-2.5 flex items-end justify-between leading-tight">
                    <div>
                      <p className="text-xs text-white/90">Cortes</p>
                      <p className="relative h-6 w-10 text-[19px] font-medium">
                        <span className="count-old absolute left-0">4/6</span>
                        <span className="count-new absolute left-0">5/6</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/90">Próximo premio</p>
                      <p className="text-[15px] font-medium">Corte gratis</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-6 gap-1.5 bg-[#142fa8] px-4 py-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`flex aspect-square items-center justify-center rounded-full bg-sun text-coal ${i === 4 ? "stamp-pop" : ""}`}>
                      <Scissors className="size-3.5" />
                    </span>
                  ))}
                  <span className="flex aspect-square items-center justify-center rounded-full border-[1.5px] border-dashed border-white/80 text-white"><Gift className="size-3.5" aria-hidden /></span>
                </div>

                <div className="mx-auto mt-3 flex size-[120px] items-center justify-center rounded-xl bg-white text-coal">
                  <Nfc className="size-16" strokeWidth={1.5} />
                </div>
                <p className="mt-2 flex items-center justify-center gap-1.5 px-2 text-xs leading-tight text-white">
                  <Nfc className="size-3.5" /> Acerca tu celular a la etiqueta
                </p>
              </div>
            </div>
          </div>
        </div>

        <WalletBadge name="Google Wallet" className="-right-8 top-[345px] lg:-right-14" />
      </div>
    </div>
  );
}
