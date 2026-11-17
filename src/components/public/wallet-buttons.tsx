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
      // Insignia oficial de Apple (guía de marca, versión es-MX): no se puede alterar su forma ni su color.
      <a href={`/card/${token}/apple-wallet`} className="mt-4 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apple-wallet/agregar-a-apple-wallet-es-mx.svg" alt="Agregar a Apple Wallet" width={158} height={50} className="mx-auto h-[50px] w-auto" />
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
