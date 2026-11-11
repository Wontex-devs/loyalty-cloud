"use client";

import { QRCodeSVG } from "qrcode.react";
import { Gift, Sparkles } from "lucide-react";
import { BrandMark, brandFont, FILLED_STAMP_ICONS, STAMP_ICON_COMPONENTS } from "./brand-mark";
import { cn } from "@/lib/utils";
import type { Business, CardStatus, LoyaltyProgram } from "@/lib/domain/types";

export interface LoyaltyCardViewProps {
  business: Pick<Business, "name" | "branding">;
  program: Pick<LoyaltyProgram, "name" | "stampsRequired" | "rewardName">;
  customerName: string;
  stamps: number;
  status: CardStatus;
  rewardsAvailable: number;
  /** Valor codificado en el QR: solo el token público, nunca IDs internos. */
  qrValue?: string;
  memberSince?: string;
  highlightLastStamp?: boolean;
  compact?: boolean;
  className?: string;
  /** Foto opcional del local: va de fondo en la parte de arriba y se funde con el color de la tarjeta. */
  coverUrl?: string;
  /** Contorno oscuro en lugar de sombra, para la portada. */
  plano?: boolean;
}

const STATUS_LABEL: Record<CardStatus, string> = {
  active: "Activa",
  reward_available: "Recompensa lista",
  blocked: "Bloqueada",
};

/** Vista de la tarjeta de fidelización. Se usa en la tarjeta pública, el editor y el escáner. */
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
  coverUrl,
  plano,
}: LoyaltyCardViewProps) {
  const b = business.branding;
  const remaining = Math.max(program.stampsRequired - stamps, 0);
  const cols = program.stampsRequired <= 10 ? Math.min(5, Math.ceil(program.stampsRequired / 2)) : 6;
  const StampIcon = STAMP_ICON_COMPONENTS[b.stampIcon ?? "check"] ?? STAMP_ICON_COMPONENTS.check;
  const font = brandFont(b);
  const titleFont = brandFont(b, "tracking-[0.12em]");
  const foto = coverUrl ?? (b.coverUrl || undefined);

  return (
    <div
      className={cn("relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[28px]", plano ? "border-2 border-coal" : "shadow-pop", className)}
      style={{ background: b.cardBackground, color: b.cardForeground }}
    >
      {/* Foto del local de fondo: se ve arriba y se funde con el color de la tarjeta hacia abajo */}
      {foto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="pointer-events-none absolute inset-x-0 top-0 h-3/5 w-full object-cover" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-3/5"
            style={{ background: `linear-gradient(to bottom, ${b.cardBackground}73 0%, ${b.cardBackground}8c 35%, ${b.cardBackground}d9 70%, ${b.cardBackground}f7 90%, ${b.cardBackground} 100%)` }}
          />
        </>
      )}
      <div className={cn("relative", compact ? "p-5" : "p-6 sm:p-7")} style={foto ? { textShadow: `0 0 3px ${b.cardBackground}, 0 1px 12px ${b.cardBackground}` } : undefined}>
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark
              branding={b}
              className={cn("size-14 rounded-full text-xl", brandFont(b, "tracking-wide"))}
              style={{ background: b.cardForeground, color: b.cardBackground }}
            />
            <div>
              <p className={cn("text-xl leading-none uppercase", titleFont)}>{business.name}</p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase opacity-60">
                {program.name.trim().toLowerCase() === business.name.trim().toLowerCase() ? "Tarjeta de fidelidad" : program.name}
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase"
            style={{
              background: status === "blocked" ? "#7f1d1d" : b.cardForeground,
              color: status === "blocked" ? "#fff" : b.cardBackground,
              textShadow: "none",
            }}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Cliente */}
        <div className={cn(compact ? "mt-5" : "mt-7")}>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase opacity-55">Miembro</p>
          <p className="mt-0.5 text-lg font-medium">{customerName}</p>
        </div>

        {/* Sellos */}
        <div className={cn("grid gap-2.5", compact ? "mt-4" : "mt-5")} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: program.stampsRequired }, (_, i) => {
            const filled = i < stamps;
            const isLast = i === program.stampsRequired - 1;
            const justAdded = highlightLastStamp && i === stamps - 1;
            return (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-full"
                style={{
                  background: filled ? b.cardForeground : "transparent",
                  border: filled ? "none" : `2px dashed ${b.cardForeground}99`,
                  color: b.cardBackground,
                }}
              >
                {filled ? (
                  <StampIcon
                    className={cn("size-[45%]", justAdded && "animate-stamp")}
                    strokeWidth={b.stampIcon && b.stampIcon !== "check" ? 2 : 2.5}
                    fill={b.stampIcon && FILLED_STAMP_ICONS.has(b.stampIcon) ? "currentColor" : "none"}
                  />
                ) : isLast ? (
                  <Gift className="size-[42%]" style={{ color: b.cardForeground, opacity: 0.85 }} strokeWidth={1.75} />
                ) : (
                  <span className="text-[11px] font-medium" style={{ color: b.cardForeground, opacity: 0.75 }}>
                    {i + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progreso */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {rewardsAvailable > 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4" /> {rewardsAvailable > 1 ? `${rewardsAvailable} recompensas` : "¡Recompensa"} disponible{rewardsAvailable > 1 ? "s" : "!"}
              </p>
            ) : (
              <p className="text-sm font-medium">
                {remaining === 0 ? "¡Meta alcanzada!" : remaining === 1 ? "¡Te falta 1 visita!" : `Te faltan ${remaining} visitas`}
              </p>
            )}
            <p className="mt-0.5 truncate text-xs opacity-65">Recompensa: {program.rewardName}</p>
          </div>
          <p className={cn("tabular shrink-0 text-3xl leading-none", font)}>
            {stamps}
            <span className="text-base opacity-50">/{program.stampsRequired}</span>
          </p>
        </div>

        {qrValue && (
          <>
            <div className="my-5 border-t border-dashed" style={{ borderColor: `${b.cardForeground}30` }} />
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                <QRCodeSVG value={qrValue} size={compact ? 84 : 104} level="M" fgColor="#111111" />
              </div>
              <div className="min-w-0 text-xs leading-relaxed opacity-75">
                <p className="font-semibold opacity-100">Muestra este código</p>
                <p>en caja para sumar tu visita o canjear tu recompensa.</p>
                {memberSince && <p className="mt-2 opacity-70">Miembro desde {memberSince}</p>}
              </div>
            </div>
          </>
        )}
        {!qrValue && memberSince && <p className="mt-4 text-xs opacity-60">Miembro desde {memberSince}</p>}
      </div>
    </div>
  );
}
