"use client";

import { useEffect, useState } from "react";
import { Bell, Gift, Wallet } from "lucide-react";

const savedKey = (token: string) => `lazo:billetera:${token}`;

/**
 * Invitación a guardar la tarjeta en la billetera del celular: Apple Wallet en iPhone y
 * Google Wallet en Android y escritorio (cada una solo si está configurada en el servidor).
 * Sin guardarla no le llegan los avisos de sellos, premios, promociones ni de cercanía.
 * Cuando el cliente ya tocó el botón en este celular, queda solo el botón, sin la invitación.
 * Si no hay billetera para este celular, muestra `fallback` (p. ej. instalar como app).
 */
export function WalletButtons({
  token,
  google,
  apple = false,
  businessName,
  color,
  emphasize = false,
  fallback = null,
}: {
  token: string;
  google: boolean;
  apple?: boolean;
  businessName: string;
  /** Color de los íconos (el de la marca). */
  color: string;
  /** Recién inscrito: la invitación se muestra aunque ya haya tocado el botón antes. */
  emphasize?: boolean;
  fallback?: React.ReactNode;
}) {
  const [ios, setIos] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    try {
      setSaved(localStorage.getItem(savedKey(token)) === "1");
    } catch {
      /* sin almacenamiento: se sigue mostrando la invitación */
    }
  }, [token]);
  if (ios === null) return null;

  const kind = ios ? (apple ? "apple" : null) : google ? "google" : null;
  if (!kind) return <>{fallback}</>;

  const markSaved = () => {
    try {
      localStorage.setItem(savedKey(token), "1");
    } catch {}
  };

  const badge =
    kind === "apple" ? (
      // Insignia oficial de Apple (guía de marca, versión es-MX): no se puede alterar su forma ni su color.
      <a href={`/card/${token}/apple-wallet`} onClick={markSaved} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apple-wallet/agregar-a-apple-wallet-es-mx.svg" alt="Agregar a Apple Wallet" width={158} height={50} className="mx-auto h-[50px] w-auto" />
      </a>
    ) : (
      // Botón oficial de Google (guía de marca): no se puede alterar su forma ni su color.
      <a href={`/card/${token}/google-wallet`} onClick={markSaved} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/google-wallet/anadir-a-google-wallet-es419.svg" alt="Agregar a la Billetera de Google" width={378} height={50} className="mx-auto h-auto w-full max-w-[378px]" />
      </a>
    );

  if (saved && !emphasize) return <div className="mt-4">{badge}</div>;

  const wallet = kind === "apple" ? "Apple Wallet" : "la Billetera de Google";
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 text-sm text-[#1a1a1a] shadow-card" aria-labelledby="billetera-titulo">
      <div className="flex items-center gap-3">
        <Wallet className="size-6 shrink-0" style={{ color }} aria-hidden />
        <h2 id="billetera-titulo" className="font-semibold">
          Guarda tu tarjeta en {wallet}
        </h2>
      </div>
      <ul className="mt-3 space-y-2 text-[#4a4a4a]">
        <li className="flex items-start gap-2">
          <Bell className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden />
          Te avisamos en el celular cada sello que sumes y cuando tu premio esté listo.
        </li>
        <li className="flex items-start gap-2">
          <Gift className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden />
          Recibe las promociones de {businessName} y tenla siempre a mano, sin buscar el enlace.
        </li>
      </ul>
      <div className="mt-4">{badge}</div>
    </section>
  );
}
