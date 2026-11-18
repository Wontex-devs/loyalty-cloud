"use client";

import { QRCodeSVG } from "qrcode.react";
import { BrandMark, brandCase, brandFont } from "./brand-mark";
import { HiloStrip } from "./hilo-strip";
import { cn } from "@/lib/utils";
import { cardTheme } from "@/lib/domain/card-palette";
import { numeroMiembro } from "@/lib/domain/hilo";
import { memberSinceText } from "@/lib/wallet/pass";
import type { Business, CardStatus, LoyaltyProgram } from "@/lib/domain/types";

export interface LoyaltyCardViewProps {
  business: Pick<Business, "name" | "branding">;
  program: Pick<LoyaltyProgram, "name" | "stampsRequired" | "rewardName">;
  customerName: string;
  stamps: number;
  status: CardStatus;
  rewardsAvailable: number;
  /** Enlace de la tarjeta para el código QR (solo el token público, nunca IDs internos). Sin él no hay QR. */
  qrValue?: string;
  /** Fecha de inscripción (ISO). Se muestra como «Nov 2026». */
  memberSince?: string;
  highlightLastStamp?: boolean;
  compact?: boolean;
  className?: string;
  /** Contorno oscuro en lugar de sombra, para la portada. */
  plano?: boolean;
}

/**
 * La tarjeta de fidelización, con la misma forma que el pase de Apple Wallet: logo y conteo
 * arriba, la franja con el premio y el hilo de sellos, los datos del miembro y el código QR.
 * Lo que se ve aquí es lo que el cliente guarda en su billetera: solo usa lo que Wallet permite
 * (dos colores planos, la letra de la marca dentro de la franja y el orden fijo de las piezas).
 * Se usa en la tarjeta pública, la vista previa del panel y la portada.
 */
export function LoyaltyCardView({
  business,
  program,
  customerName,
  stamps,
  status,
  rewardsAvailable,
  qrValue,
  memberSince,
  highlightLastStamp,
  compact,
  className,
  plano,
}: LoyaltyCardViewProps) {
  const b = business.branding;
  // Exactamente los dos colores del comercio, como en el pase.
  const c = cardTheme({ cardBackground: b.cardBackground, cardForeground: b.cardForeground });
  const required = program.stampsRequired;
  const sellos = Math.min(stamps, required);
  const remaining = Math.max(required - sellos, 0);
  const ready = rewardsAvailable > 0 || status === "reward_available";
  const desde = memberSinceText(memberSince);
  const qr = qrValue && b.passQr !== false ? qrValue : null;
  // Mismo texto que el pase muestra y envía como notificación.
  const progreso =
    status === "blocked"
      ? "Tarjeta bloqueada. Habla con el comercio."
      : ready
        ? `Premio listo: ${program.rewardName}`
        : `${remaining === 1 ? "Te falta 1 visita" : `Te faltan ${remaining} visitas`} para ${program.rewardName}`;

  const nombreLargo = business.name.trim().length;
  const label = "text-[10.5px] leading-tight font-semibold tracking-[0.06em] uppercase";
  const pad = compact ? "px-4" : "px-5";

  return (
    <div className={cn("relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[18px]", plano ? "border-2 border-coal" : "shadow-pop", className)} style={{ background: c.bg, color: c.text }}>
      {/* Fila superior: es lo que asoma cuando las tarjetas están apiladas en Wallet */}
      <div className={cn("flex items-center justify-between gap-3 pt-4 pb-3", pad)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark branding={b} className={cn("size-9 rounded-full text-sm", brandFont(b, "tracking-wide"))} style={{ background: c.accent, color: c.onAccent }} />
          {/* Como en el logo del pase, un nombre largo se achica para caber. */}
          <p className={cn("truncate leading-tight", nombreLargo > 18 ? "text-[13px]" : nombreLargo > 12 ? "text-[15px]" : "text-[17px]", brandCase(b), brandFont(b, "tracking-[0.1em]"))}>
            {business.name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={label} style={{ color: c.passLabel }}>
            Sellos
          </p>
          <p className="tabular text-[19px] leading-tight">
            {sellos} / {required}
          </p>
        </div>
      </div>

      <HiloStrip
        branding={b}
        theme={c}
        monogram={business.name}
        stamps={sellos}
        required={required}
        rewardName={program.rewardName}
        rewardReady={ready}
        highlightLastStamp={highlightLastStamp}
      />

      {/* Datos del miembro */}
      <div className={cn("flex items-start justify-between gap-4 pt-3", pad)}>
        <div className="min-w-0">
          <p className={label} style={{ color: c.passLabel }}>
            Miembro
          </p>
          <p className="truncate text-[16px] leading-snug">{customerName}</p>
        </div>
        {desde && (
          <div className="shrink-0 text-right">
            <p className={label} style={{ color: c.passLabel }}>
              Desde
            </p>
            <p className="text-[16px] leading-snug">{desde}</p>
          </div>
        )}
      </div>
      <div className={cn("pt-2.5", pad, !qr && (compact ? "pb-5" : "pb-7"))}>
        <p className={label} style={{ color: c.passLabel }}>
          Tu progreso
        </p>
        <p className="text-[15px] leading-snug">{progreso}</p>
      </div>

      {/* Código QR sobre blanco, como lo pone Wallet */}
      {qr && (
        <div className={cn("flex justify-center", compact ? "py-4" : "pt-6 pb-6")}>
          <div className="rounded-lg bg-white px-3 pt-3 pb-2 text-center">
            <QRCodeSVG value={qr} size={compact ? 92 : 116} level="M" fgColor="#111111" />
            <p className="mt-1.5 text-[11px] tracking-wide text-[#333333]">Miembro N.º {numeroMiembro(qr.split("/").pop() ?? qr)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
