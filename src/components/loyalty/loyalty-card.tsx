"use client";

import { QRCodeSVG } from "qrcode.react";
import { Gift, Sparkles } from "lucide-react";
import { BrandMark, brandCase, brandFont, StampMark } from "./brand-mark";
import { cn } from "@/lib/utils";
import { alpha, cardPalette } from "@/lib/domain/card-palette";
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

/** La foto se desvanece hacia abajo y deja ver el color de la tarjeta, sin corte. */
const FADE: React.CSSProperties = {
  maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)",
  WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)",
};

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
  const c = cardPalette(b);
  const remaining = Math.max(program.stampsRequired - stamps, 0);
  const cols = program.stampsRequired <= 10 ? Math.min(5, Math.ceil(program.stampsRequired / 2)) : 6;
  const font = brandFont(b);
  const titleFont = brandFont(b, "tracking-[0.12em]");
  const foto = coverUrl ?? (b.coverUrl || undefined);
  const pad = compact ? "px-5" : "px-6 sm:px-7";
  const subtitle = program.name.trim().toLowerCase() === business.name.trim().toLowerCase() ? "Tarjeta de fidelidad" : program.name;
  // Sobre la foto el encabezado va siempre en blanco, con una sombra oscura suave detrás.
  const headText = foto ? "#FFFFFF" : c.text;
  const headMuted = foto ? "rgba(255, 255, 255, 0.78)" : c.muted;
  const ready = rewardsAvailable > 0 || status === "reward_available";

  return (
    <div
      className={cn("relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[28px]", plano ? "border-2 border-coal" : "shadow-pop", className)}
      style={{ background: c.bg, color: c.text }}
    >
      {/* Brillo suave: le da profundidad al color plano */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(140deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.14) 100%)" }} />

      {/* Encabezado: logo, comercio y estado (sobre la foto del local si hay) */}
      <div className={cn("relative", pad, compact ? "pt-5" : "pt-6 sm:pt-7", foto ? (compact ? "pb-12" : "pb-16") : "pb-1")}>
        {foto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" style={FADE} />
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ ...FADE, background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.2))" }} />
          </>
        )}
        <div className="relative flex items-start justify-between gap-3" style={{ color: headText }}>
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark
              branding={b}
              className={cn("size-12 rounded-full text-lg shadow-sm", brandFont(b, "tracking-wide"))}
              style={{ background: c.accent, color: c.onAccent }}
            />
            <div className="min-w-0" style={foto ? { textShadow: "0 1px 8px rgba(0,0,0,0.45)" } : undefined}>
              <p className={cn("text-xl leading-tight break-words", brandCase(b), titleFont)}>{business.name}</p>
              <p className="mt-1 text-[10px] leading-snug font-medium tracking-[0.16em] uppercase" style={{ color: headMuted }}>
                {subtitle}
              </p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase backdrop-blur-sm"
            style={
              status === "blocked"
                ? { background: "#7f1d1d", color: "#fff" }
                : ready
                  ? { background: c.accent, color: c.onAccent }
                  : { background: foto ? "rgba(0,0,0,0.32)" : c.slot, color: headText }
            }
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className={cn("relative", pad, compact ? "pb-5" : "pb-6 sm:pb-7", foto ? "-mt-6" : compact ? "mt-4" : "mt-5")}>
        {/* Cliente */}
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase" style={{ color: c.muted }}>
          Miembro
        </p>
        <p className="mt-0.5 truncate text-lg font-medium">{customerName}</p>

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
                style={
                  filled
                    ? { background: c.accent, color: c.onAccent, boxShadow: "0 2px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.28)" }
                    : isLast
                      ? { background: alpha(c.accent, 0.14), border: `1.5px solid ${alpha(c.accent, 0.7)}`, color: c.accent }
                      : { background: c.slot, border: `1px solid ${c.slotBorder}` }
                }
              >
                {filled ? (
                  <StampMark branding={b} className={cn(b.stampUrl ? "size-[88%]" : "size-[46%]", justAdded && "animate-stamp")} />
                ) : isLast ? (
                  <Gift className="size-[44%]" strokeWidth={1.75} />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Progreso */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {rewardsAvailable > 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4" style={{ color: c.accent }} /> {rewardsAvailable > 1 ? `${rewardsAvailable} recompensas` : "¡Recompensa"} disponible{rewardsAvailable > 1 ? "s" : "!"}
              </p>
            ) : (
              <p className="text-sm font-semibold">
                {remaining === 0 ? "¡Meta alcanzada!" : remaining === 1 ? "¡Te falta 1 visita!" : `Te faltan ${remaining} visitas`}
              </p>
            )}
            <p className="mt-0.5 truncate text-xs" style={{ color: c.muted }}>
              Premio: {program.rewardName}
            </p>
          </div>
          <p className={cn("tabular shrink-0 text-3xl leading-none", font)}>
            {stamps}
            <span className="text-base" style={{ color: c.muted }}>
              /{program.stampsRequired}
            </span>
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: c.slot }}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(Math.min(stamps, program.stampsRequired) / program.stampsRequired) * 100}%`, background: c.accent }} />
        </div>

        {qrValue && (
          <>
            <div className="my-5 border-t" style={{ borderColor: c.slotBorder }} />
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                <QRCodeSVG value={qrValue} size={compact ? 84 : 104} level="M" fgColor="#111111" />
              </div>
              <div className="min-w-0 text-xs leading-relaxed" style={{ color: c.muted }}>
                <p className="font-semibold" style={{ color: c.text }}>
                  Muestra este código
                </p>
                <p>en caja para sumar tu visita o canjear tu recompensa.</p>
                {memberSince && <p className="mt-2">Miembro desde {memberSince}</p>}
              </div>
            </div>
          </>
        )}
        {!qrValue && memberSince && (
          <p className="mt-4 text-xs" style={{ color: c.muted }}>
            Miembro desde {memberSince}
          </p>
        )}
      </div>
    </div>
  );
}
