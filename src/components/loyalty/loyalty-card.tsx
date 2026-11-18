"use client";

import { QRCodeSVG } from "qrcode.react";
import { Gift, Sparkles } from "lucide-react";
import { BrandMark, brandCase, brandFont, StampMark } from "./brand-mark";
import { cn } from "@/lib/utils";
import { alpha, cardTheme, GOLD } from "@/lib/domain/card-palette";
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
  const c = cardTheme(b);
  const premium = c.style !== "clasico";
  const remaining = Math.max(program.stampsRequired - stamps, 0);
  const cols = program.stampsRequired <= 10 ? Math.min(5, Math.ceil(program.stampsRequired / 2)) : 6;
  const font = brandFont(b);
  const titleFont = brandFont(b, "tracking-[0.12em]");
  const rawFoto = coverUrl ?? (b.coverUrl || undefined);
  const foto = c.photo === "none" ? undefined : rawFoto;
  const pad = compact ? "px-5" : "px-6 sm:px-7";
  const subtitle = program.name.trim().toLowerCase() === business.name.trim().toLowerCase() ? "Tarjeta de fidelidad" : program.name;
  // Sobre la foto (clásico) el encabezado va siempre en blanco, con una sombra oscura suave detrás.
  const onPhoto = !!foto && c.photo === "fade";
  const headText = onPhoto ? "#FFFFFF" : c.text;
  const headMuted = onPhoto ? "rgba(255, 255, 255, 0.78)" : c.style === "noche" ? c.label : c.muted;
  const ready = rewardsAvailable > 0 || status === "reward_available";
  const labelClass = cn("text-[10px] font-semibold uppercase", premium ? "tracking-[0.3em]" : "tracking-[0.22em]");
  const progress = (Math.min(stamps, program.stampsRequired) / program.stampsRequired) * 100;
  const pct = `${progress}%`;

  const stampsAndProgress = (
    <>
      {/* Sellos */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
                  ? { background: c.accentCss, color: c.onAccent, boxShadow: "0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)" }
                  : isLast
                    ? { background: alpha(c.accent, c.style === "negro" ? 0 : 0.12), border: `1px solid ${alpha(c.accent, 0.75)}`, color: c.accent }
                    : { background: c.slot, border: `1px solid ${c.slotBorder}` }
              }
            >
              {filled ? (
                <StampMark branding={b} className={cn(b.stampUrl ? "size-[86%]" : "size-[46%]", justAdded && "animate-stamp")} />
              ) : isLast ? (
                <Gift className="size-[42%]" strokeWidth={1.5} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Progreso */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {premium && (
            <p className={labelClass} style={{ color: c.label }}>
              Tu premio
            </p>
          )}
          {rewardsAvailable > 0 ? (
            <p className={cn("flex items-center gap-1.5 text-sm font-semibold", premium && "mt-1")}>
              <Sparkles className="size-4" style={{ color: c.accent }} /> {rewardsAvailable > 1 ? `${rewardsAvailable} recompensas` : "¡Recompensa"} disponible{rewardsAvailable > 1 ? "s" : "!"}
            </p>
          ) : premium ? (
            <p className="mt-1 truncate text-sm">
              {program.rewardName}
              <span style={{ color: c.muted }}> · {remaining === 0 ? "¡lista!" : remaining === 1 ? "falta 1" : `faltan ${remaining}`}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold">{remaining === 0 ? "¡Meta alcanzada!" : remaining === 1 ? "¡Te falta 1 visita!" : `Te faltan ${remaining} visitas`}</p>
          )}
          {!premium && (
            <p className="mt-0.5 truncate text-xs" style={{ color: c.muted }}>
              Premio: {program.rewardName}
            </p>
          )}
        </div>
        <p
          className={cn("tabular shrink-0 text-3xl leading-none", c.style === "noche" ? "font-serif" : font)}
          style={c.style === "noche" ? { backgroundImage: c.accentCss, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}
        >
          {stamps}
          <span className="text-base" style={c.style === "noche" ? undefined : { color: c.muted }}>
            /{program.stampsRequired}
          </span>
        </p>
      </div>
      <div className={cn("mt-3 overflow-hidden rounded-full", premium ? "h-[3px]" : "h-1.5")} style={{ background: c.style === "negro" ? alpha("#FFFFFF", 0.1) : c.slot }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct, background: c.accentCss }} />
      </div>
    </>
  );

  const card = (
    <div className={cn("relative overflow-hidden", c.frame ? "rounded-[27px]" : "rounded-[28px]")} style={{ background: c.bgCss, color: c.text }}>
      {/* Cristal: la foto ocupa toda la tarjeta, con un velo del color del comercio */}
      {foto && c.photo === "full" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: c.veil }} />
        </>
      )}
      {c.style === "negro" && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />}

      {/* Encabezado: logo, comercio y estado */}
      <div className={cn("relative", pad, compact ? "pt-5" : "pt-6 sm:pt-7", foto && c.photo !== "full" ? (compact ? "pb-12" : "pb-16") : "pb-1")}>
        {foto && (c.photo === "fade" || c.photo === "tint") && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt=""
              className={cn("pointer-events-none absolute inset-0 size-full object-cover", c.photo === "tint" && "opacity-40 mix-blend-luminosity")}
              style={FADE}
            />
            {c.photo === "fade" && (
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ ...FADE, background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.2))" }} />
            )}
          </>
        )}
        <div className="relative flex items-start justify-between gap-3" style={{ color: headText }}>
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark
              branding={b}
              className={cn("size-12 rounded-full text-lg shadow-sm", brandFont(b, "tracking-wide"))}
              style={{ background: c.accentCss, color: c.onAccent, ...(c.style === "noche" ? { boxShadow: `0 0 0 1px ${GOLD}` } : {}) }}
            />
            <div className="min-w-0" style={onPhoto || c.photo === "full" ? { textShadow: "0 1px 8px rgba(0,0,0,0.45)" } : undefined}>
              <p className={cn("text-xl leading-tight break-words", brandCase(b), titleFont)}>{business.name}</p>
              <p className={cn("mt-1 text-[10px] leading-snug font-medium uppercase", premium ? "tracking-[0.3em]" : "tracking-[0.16em]")} style={{ color: headMuted }}>
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
                  ? { background: c.accentCss, color: c.onAccent }
                  : premium
                    ? { border: `1px solid ${c.slotBorder}`, color: c.style === "noche" ? c.label : headText }
                    : { background: onPhoto ? "rgba(0,0,0,0.32)" : c.slot, color: headText }
            }
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className={cn("relative", pad, compact ? "pb-5" : "pb-6 sm:pb-7", foto && c.photo !== "full" ? "-mt-6" : c.photo === "full" ? (compact ? "mt-10" : "mt-14") : compact ? "mt-4" : "mt-6")}>
        {/* Cliente */}
        <p className={labelClass} style={{ color: c.label }}>
          Miembro
        </p>
        <p className={cn("mt-0.5 truncate text-lg", c.style === "noche" ? "font-serif tracking-wide" : "font-medium", c.style === "negro" && "tracking-wide")}>{customerName}</p>

        <div className={cn(compact ? "mt-4" : "mt-5", c.glass && "rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-xl")}>{stampsAndProgress}</div>

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

  return (
    <div
      className={cn("relative mx-auto w-full max-w-[440px] rounded-[28px]", plano ? "border-2 border-coal" : "shadow-pop", c.frame && "p-px", className)}
      style={c.frame ? { background: c.frame } : undefined}
    >
      {card}
    </div>
  );
}
