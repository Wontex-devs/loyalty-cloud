import { ImageResponse } from "next/og";
import { alpha, cardTheme } from "@/lib/domain/card-palette";
import type { BusinessBranding } from "@/lib/domain/types";

/**
 * Franja minimalista del pase (PNG): color sólido (color 1 del comercio), «VISITAS 3 de 8»
 * con los sellos como una cadena de círculos con check (color 2) y la recompensa con su
 * icono de regalo. Sin adornos.
 * Va en el pase de Apple Wallet (strip) y como imagen principal del pase de Google Wallet.
 */
export interface PassStripInput {
  branding: Pick<BusinessBranding, "cardBackground" | "cardForeground">;
  stamps: number;
  required: number;
  rewardName: string;
  /** Hay un premio listo para canjear. */
  rewardReady?: boolean;
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" };

const CHECK = "M20 6 9 17l-5-5";
const GIFT = [
  "M12 7v14",
  "M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8",
  "M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5",
];

export function passStrip(
  { branding, stamps, required, rewardName, rewardReady }: PassStripInput,
  width: number,
  height: number,
  opts: { headers?: Record<string, string>; fonts?: Font[] } = {},
) {
  // El pase usa exactamente los dos colores del comercio: fondo (color 1) y acento (color 2).
  const c = cardTheme({ cardBackground: branding.cardBackground, cardForeground: branding.cardForeground });
  const k = height / 144; // la franja de Apple mide 144 puntos de alto
  const text = c.text;
  const muted = alpha(text, 0.62);
  const line = alpha(text, 0.18);
  const font = opts.fonts?.some((f) => f.name === "Texto") ? "Texto" : undefined;
  const pad = 18 * k;

  // Cadena de sellos: círculos unidos por una línea fina, a la derecha de «3 de 8».
  const left = 112 * k;
  const avail = width - pad * 2 - left;
  const link = Math.max(4 * k, Math.min(10 * k, avail / (required * 4)));
  const d = Math.floor(Math.min(26 * k, (avail - link * (required - 1)) / required));
  const ring = Math.max(1.5, 1.6 * k);

  const chain = Array.from({ length: required }, (_, i) => {
    const filled = i < stamps;
    return (
      <div key={i} style={{ display: "flex", alignItems: "center" }}>
        {i > 0 && <div style={{ width: link, height: ring, background: i <= stamps - 1 ? c.accent : alpha(c.accent, 0.45) }} />}
        <div
          style={{
            width: d,
            height: d,
            borderRadius: d,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: filled ? c.accent : "transparent",
            border: filled ? "none" : `${ring}px solid ${alpha(c.accent, 0.7)}`,
          }}
        >
          {filled && (
            <svg width={d * 0.56} height={d * 0.56} viewBox="0 0 24 24" fill="none" stroke={c.onAccent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d={CHECK} />
            </svg>
          )}
        </div>
      </div>
    );
  });

  const full = { top: 0, left: 0, width, height } as const;
  return new ImageResponse(
    (
      <div style={{ ...full, position: "relative", display: "flex", background: c.bg, color: text, fontFamily: font }}>
        {/* Visitas y cadena de sellos */}
        <div style={{ position: "absolute", left: pad, top: 14 * k, width: width - pad * 2, height: 56 * k, display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", width: left }}>
            <div style={{ display: "flex", fontSize: 10.5 * k, letterSpacing: 1.2 * k, color: muted, textTransform: "uppercase" }}>Visitas</div>
            <div style={{ display: "flex", fontSize: 24 * k, fontWeight: 600, marginTop: 1 * k }}>{`${stamps} de ${required}`}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>{chain}</div>
        </div>
        <div style={{ position: "absolute", left: pad, top: 80 * k, width: width - pad * 2, height: Math.max(1, k), background: line }} />

        {/* Recompensa */}
        <div style={{ position: "absolute", left: pad, top: 88 * k, height: 48 * k, width: width * 0.66, display: "flex", alignItems: "center" }}>
          <svg width={26 * k} height={26 * k} viewBox="0 0 24 24" fill="none" stroke={text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            {GIFT.map((g) => (
              <path key={g} d={g} />
            ))}
            <rect x={3} y={7} width={18} height={4} rx={1} />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 12 * k }}>
            <div style={{ display: "flex", fontSize: 11 * k, color: muted }}>{rewardReady ? "¡Tu recompensa está lista!" : "Recompensa:"}</div>
            <div style={{ display: "flex", fontSize: 15 * k, fontWeight: 500, marginTop: 1 * k }}>{rewardName}</div>
          </div>
        </div>
      </div>
    ),
    { width, height, headers: opts.headers, fonts: opts.fonts },
  );
}
