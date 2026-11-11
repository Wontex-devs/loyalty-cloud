"use client";

import { useEffect, useState } from "react";

/**
 * Botones de billetera. Hoy: Google Wallet (Android y escritorio).
 * Apple Wallet se añadirá aquí mismo con su propio botón para iPhone.
 */
export function WalletButtons({ token, google }: { token: string; google: boolean }) {
  const [ios, setIos] = useState<boolean | null>(null);
  useEffect(() => setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)), []);
  if (!google || ios === null || ios) return null;

  return (
    // Botón oficial de Google (guía de marca): no se puede alterar su forma ni su color.
    <a href={`/card/${token}/google-wallet`} className="mt-4 block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/google-wallet/anadir-a-google-wallet-es419.svg" alt="Agregar a la Billetera de Google" width={378} height={50} className="mx-auto h-auto w-full max-w-[378px]" />
    </a>
  );
}
