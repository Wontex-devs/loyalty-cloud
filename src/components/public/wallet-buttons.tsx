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
    <a
      href={`/card/${token}/google-wallet`}
      className="mt-4 flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-black text-[15px] font-medium text-white shadow-card"
    >
      <WalletGlyph />
      Añadir a Google Wallet
    </a>
  );
}

function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="3" fill="#fff" opacity=".18" />
      <path d="M2 9.5h20" stroke="#4285F4" strokeWidth="2.2" />
      <path d="M2 12.5h20" stroke="#EA4335" strokeWidth="2.2" />
      <path d="M2 15.5h20" stroke="#FBBC04" strokeWidth="2.2" />
      <rect x="2" y="5" width="20" height="14" rx="3" fill="none" stroke="#34A853" strokeWidth="1.6" />
    </svg>
  );
}
