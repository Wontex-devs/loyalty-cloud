import { Check, Nfc, Scissors } from "lucide-react";

/** iPhone flotando con la tarjeta de un negocio de ejemplo en Wallet. */
export function WalletPhone() {
  return (
    <div className="phone-frame" role="img" aria-label="iPhone con la tarjeta de sellos de Barbería Norte en Wallet, recién acercado a un lector">
      <div className="phone-scene">
        <div aria-hidden className="phone-shadow" />

        {/* iPhone */}
        <div className="phone-float absolute left-[70px] top-6 h-[610px] w-[300px] rounded-[50px] bg-gradient-to-br from-[#d8d5ce] via-[#a9a69f] to-[#7f7c76] p-[3px]">
          <div className="h-full rounded-[47px] bg-black p-[8px]">
            <div className="relative h-full overflow-hidden rounded-[39px] bg-[#f2f2f7] text-black">
              <div className="absolute left-1/2 top-2.5 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
              <div className="flex items-center justify-between px-7 pt-3.5 text-[13px] font-semibold">
                <span>9:41</span>
                <span>5G</span>
              </div>

              {/* Pase */}
              <div className="mx-3 mt-6 rounded-2xl bg-cobalt p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-sun text-[11px] font-bold text-coal">BN</span>
                    <span className="text-sm font-semibold">Barbería Norte</span>
                  </div>
                  <div className="text-right leading-tight">
                    <p className="text-[9px] font-semibold uppercase text-white/75">Sellos</p>
                    <p className="text-base font-semibold">5/6</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={i < 5 ? "flex aspect-square items-center justify-center rounded-full bg-sun text-coal" : "aspect-square rounded-full border-[1.5px] border-dashed border-white/70"}
                    >
                      {i < 5 && <Scissors className="size-3.5" />}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex justify-between text-xs leading-tight">
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-white/75">Cliente</p>
                    <p className="font-medium">Andrés Ruiz</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-semibold uppercase text-white/75">Premio</p>
                    <p className="font-medium">Corte gratis</p>
                  </div>
                </div>
              </div>

              {/* Momento del tap */}
              <div className="mt-9 flex flex-col items-center">
                <span className="relative flex size-16 items-center justify-center rounded-full border-2 border-cobalt text-cobalt">
                  <Check className="size-8" />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-sun text-coal">
                    <Nfc className="size-4" />
                  </span>
                </span>
                <p className="mt-3 text-[15px] font-semibold">Sello registrado</p>
                <p className="text-[13px] text-[#6c6c70]">Te falta 1 visita</p>
              </div>

              {/* Otros pases guardados */}
              <div className="absolute inset-x-3 bottom-0">
                <div className="h-9 rounded-t-xl bg-sun" />
                <div className="-mt-5 h-9 rounded-t-xl bg-[#c9d3fb]" />
                <div className="-mt-5 h-7 rounded-t-xl bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.1)]" />
              </div>
              <div className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-black" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
