"use client";

import { useEffect, useState } from "react";

/**
 * Botones de billetera: Apple Wallet en iPhone y Google Wallet en Android y escritorio.
 * Cada uno solo aparece si su billetera está configurada en el servidor.
 */
export function WalletButtons({ token, google, apple = false }: { token: string; google: boolean; apple?: boolean }) {
  const [ios, setIos] = useState<boolean | null>(null);
  useEffect(() => setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)), []);
  if (ios === null) return null;

  if (ios) {
    if (!apple) return null;
    return (
      // Provisional: antes de abrir al público va la insignia oficial «Añadir a Apple Wallet»
      // (guía de marca de Apple; ver docs/ETAPA-15-APPLE-WALLET.md).
      <a
        href={`/card/${token}/apple-wallet`}
        className="mx-auto mt-4 flex h-12 w-full max-w-[378px] items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white"
      >
        Añadir a Apple Wallet
      </a>
    );
  }

  if (!google) return null;
  return (
    // Botón oficial de Google (guía de marca): no se puede alterar su forma ni su color.
    <a href={`/card/${token}/google-wallet`} className="mt-4 block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/google-wallet/anadir-a-google-wallet-es419.svg" alt="Agregar a la Billetera de Google" width={378} height={50} className="mx-auto h-auto w-full max-w-[378px]" />
    </a>
  );
}
