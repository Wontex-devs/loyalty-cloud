import { Gift } from "lucide-react";
import { alpha, type CardTheme } from "@/lib/domain/card-palette";
import { ajustePremio, hilo } from "@/lib/domain/hilo";
import type { BusinessBranding } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { brandCase, brandFont, StampMark } from "./brand-mark";

const W = 375;
const H = 144;
/** Porcentajes sobre la franja de 375 × 144, y letras en unidades del ancho de la franja (cqw). */
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;
const cqw = (v: number) => `${(v / W) * 100}cqw`;

/**
 * Franja de la tarjeta web con «el hilo»: la misma composición que la imagen del pase de Wallet
 * (`passStrip`), dibujada con la misma geometría para que lo que se ve aquí sea lo que se guarda.
 */
export function HiloStrip({
  branding,
  theme: c,
  monogram,
  stamps,
  required,
  rewardName,
  rewardReady,
  highlightLastStamp,
}: {
  branding: Pick<BusinessBranding, "font" | "stampIcon" | "stampUrl">;
  theme: CardTheme;
  monogram: string;
  stamps: number;
  required: number;
  rewardName: string;
  rewardReady: boolean;
  highlightLastStamp?: boolean;
}) {
  const h = hilo(required, W, H);
  const lista = rewardReady || stamps >= required;
  const upper = brandCase(branding) === "uppercase";
  const linea = alpha(c.accent, 0.55);
  const premio = ajustePremio(rewardName, upper);

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size", background: c.bg, color: c.text }}>
      {/* Marca de agua: la inicial del comercio */}
      <span
        aria-hidden
        className={cn("pointer-events-none absolute leading-none select-none", brandFont(branding))}
        style={{ left: px(W - 118), top: py(6), fontSize: cqw(190), color: alpha(c.text, 0.055) }}
      >
        {monogram.trim().slice(0, 1).toUpperCase()}
      </span>

      {/* El premio, protagonista */}
      <p className="absolute font-medium uppercase" style={{ left: px(20), top: py(16), fontSize: cqw(11.5), letterSpacing: "0.19em", lineHeight: 1.2, color: c.passLabel }}>
        {lista ? "Recompensa lista" : "Próxima recompensa"}
      </p>
      <p
        className={cn("absolute", premio.lines === 1 && "whitespace-nowrap", brandFont(branding), upper && "uppercase")}
        style={{ left: px(20), top: py(33), width: px(W - 40), fontSize: cqw(premio.size), lineHeight: 1.15, letterSpacing: upper ? "0.05em" : undefined }}
      >
        {premio.text}
      </p>

      {/* El hilo */}
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full">
        {h.hilos.map((d) => (
          <path key={d} d={d} fill="none" stroke={linea} strokeWidth={h.trazo} />
        ))}
      </svg>

      {/* Los sellos */}
      <ul aria-label={`${Math.min(stamps, required)} de ${required} sellos`}>
        {h.sellos.map((s) => {
          const ganado = s.index < stamps;
          const centro: React.CSSProperties = { left: px(s.x), top: py(s.y), transform: "translate(-50%, -50%)" };
          if (s.premio) {
            return (
              <li
                key={s.index}
                className="absolute flex aspect-square items-center justify-center rounded-full"
                style={{ ...centro, width: px(h.aro * 2), border: `1px solid ${linea}` }}
              >
                <span
                  className="flex aspect-square items-center justify-center rounded-full"
                  style={{ width: `${(s.r / h.aro) * 100}%`, background: lista ? c.accent : c.bg, border: `1.3px solid ${c.accent}`, color: lista ? c.onAccent : c.accent }}
                >
                  <Gift className="size-[52%]" strokeWidth={1.6} />
                </span>
              </li>
            );
          }
          return (
            <li
              key={s.index}
              className="absolute flex aspect-square items-center justify-center rounded-full"
              style={{
                ...centro,
                width: px(s.r * 2),
                background: ganado ? c.accent : c.bg,
                color: c.onAccent,
                border: ganado ? undefined : `1.1px solid ${alpha(c.accent, 0.6)}`,
              }}
            >
              {ganado && (
                <StampMark
                  branding={branding}
                  className={cn(branding.stampUrl ? "size-[90%]" : "size-[56%]", highlightLastStamp && s.index === stamps - 1 && "animate-stamp")}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
