"use client";

import { BrandMark, brandCase, brandFont, FuenteMarca } from "./brand-mark";
import { HiloStrip } from "./hilo-strip";
import { CodigoQr } from "./codigo-qr";
import { cn } from "@/lib/utils";
import { cardTheme } from "@/lib/domain/card-palette";
import type { Business, CardStatus, LoyaltyProgram } from "@/lib/domain/types";

export interface LoyaltyCardViewProps {
  business: Pick<Business, "name" | "branding">;
  program: Pick<LoyaltyProgram, "name" | "stampsRequired" | "rewardName">;
  /** Nombre del cliente: va debajo de los sellos, como en el pase de Wallet. */
  customerName?: string;
  stamps: number;
  status: CardStatus;
  rewardsAvailable: number;
  /** Ya no se muestra en la tarjeta. */
  memberSince?: string;
  highlightLastStamp?: boolean;
  compact?: boolean;
  className?: string;
  /** Contorno oscuro en lugar de sombra, para la portada. */
  plano?: boolean;
  /** Número de la tarjeta (12 dígitos): va en el código QR del pie, como en el pase de Wallet. */
  scanCode?: string;
}

/**
 * La tarjeta de fidelización, con la misma forma que el pase de Apple Wallet: logo y conteo
 * arriba, la franja con el premio y el hilo de sellos, el nombre del miembro y el código QR.
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
  highlightLastStamp,
  compact,
  className,
  plano,
  scanCode,
}: LoyaltyCardViewProps) {
  const b = business.branding;
  // Exactamente los dos colores del comercio, como en el pase.
  const c = cardTheme({ cardBackground: b.cardBackground, cardForeground: b.cardForeground });
  const required = program.stampsRequired;
  const sellos = Math.min(stamps, required);
  const ready = rewardsAvailable > 0 || status === "reward_available";
  const nombreLargo = business.name.trim().length;
  const label = "text-[10.5px] leading-tight font-semibold tracking-[0.06em] uppercase";
  const pad = compact ? "px-4" : "px-5";

  return (
    <div className={cn("relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[18px]", plano ? "border-2 border-coal" : "shadow-pop", className)} style={{ background: c.bg, color: c.text }}>
      <FuenteMarca branding={b} />
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

      {/* El nombre del cliente, como el campo «MIEMBRO» del pase */}
      {customerName?.trim() && (
        <div className={cn("pt-3", pad)}>
          <p className={label} style={{ color: c.passLabel }}>
            Miembro
          </p>
          <p className="truncate text-[16px] leading-snug">{customerName.trim()}</p>
        </div>
      )}

      {scanCode ? (
        <div className={cn("pt-4", pad, compact ? "pb-4" : "pb-5")}>
          <CodigoQr codigo={scanCode} />
        </div>
      ) : (
        <div className={compact ? "h-4" : "h-5"} />
      )}
    </div>
  );
}
