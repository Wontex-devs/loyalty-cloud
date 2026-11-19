import { ImageResponse } from "next/og";
import { alpha, cardTheme } from "@/lib/domain/card-palette";
import { ajustePremio, hilo, ILUSTRACION } from "@/lib/domain/hilo";
import type { BusinessBranding } from "@/lib/domain/types";
import { Icon } from "./stamp-icons";

/**
 * Franja del pase (PNG), con la composición «el hilo»: el premio como protagonista, en la letra
 * de la marca, y debajo un hilo fino que enhebra los sellos hasta cerrar en un aro alrededor del
 * premio. De fondo, la inicial del comercio, casi transparente.
 * Usa exactamente los dos colores del comercio: fondo (color 1) y sellos y detalles (color 2).
 * Va en el pase de Apple Wallet (strip) y como imagen principal del pase de Google Wallet.
 * La tarjeta web dibuja lo mismo con `HiloStrip`, a partir de la misma geometría (`hilo`).
 */
export interface PassStripInput {
  branding: Pick<BusinessBranding, "cardBackground" | "cardForeground" | "stampIcon" | "stampUrl" | "illustrationUrl">;
  stamps: number;
  required: number;
  rewardName: string;
  /** Hay un premio listo para canjear. */
  rewardReady?: boolean;
  /** Inicial del comercio para la marca de agua. */
  monogram?: string;
  /** La letra de la marca va en mayúsculas (todas menos la manuscrita). */
  upper?: boolean;
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" };

export function passStrip(
  { branding, stamps, required, rewardName, rewardReady, monogram, upper }: PassStripInput,
  width: number,
  height: number,
  opts: { headers?: Record<string, string>; fonts?: Font[] } = {},
) {
  const c = cardTheme({ cardBackground: branding.cardBackground, cardForeground: branding.cardForeground });
  const k = height / 144; // la franja de Apple mide 144 puntos de alto
  const texto = opts.fonts?.some((f) => f.name === "Texto") ? "Texto" : undefined;
  const marca = opts.fonts?.some((f) => f.name === "Marca") ? "Marca" : texto;
  const pad = 20 * k;
  const stampUrl = branding.stampUrl?.startsWith("https://") ? branding.stampUrl : null;
  const ilustracion = branding.illustrationUrl?.startsWith("https://") ? branding.illustrationUrl : null;
  const h = hilo(required, width, height);
  const lista = !!rewardReady || stamps >= required;
  const premio = ajustePremio(rewardName, upper);
  const inicial = (monogram ?? "").trim().slice(0, 1).toUpperCase();
  const linea = alpha(c.accent, 0.55);

  const circulo = (x: number, y: number, r: number): React.CSSProperties => ({
    position: "absolute",
    left: x - r,
    top: y - r,
    width: r * 2,
    height: r * 2,
    borderRadius: r,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  return new ImageResponse(
    (
      <div style={{ width, height, position: "relative", display: "flex", overflow: "hidden", background: c.bg, color: c.text, fontFamily: texto }}>
        {/* De fondo: la ilustración del comercio o, si no tiene, su inicial casi transparente */}
        {ilustracion ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            // Pegada a la derecha: la franja de Google es más ancha que la de Apple.
            src={ilustracion}
            width={ILUSTRACION.ancho * k}
            height={ILUSTRACION.alto * k}
            style={{ position: "absolute", left: width - (375 - ILUSTRACION.x) * k, top: ILUSTRACION.y * k, objectFit: "contain", opacity: ILUSTRACION.opacidad }}
          />
        ) : inicial && (
          <div
            style={{
              position: "absolute",
              left: width - 118 * k,
              top: 6 * k,
              display: "flex",
              fontFamily: marca,
              fontSize: 190 * k,
              lineHeight: 1,
              color: alpha(c.text, 0.055),
            }}
          >
            {inicial}
          </div>
        )}

        {/* El premio, protagonista */}
        <div style={{ position: "absolute", left: pad, top: 16 * k, display: "flex", fontSize: 11.5 * k, fontWeight: 500, letterSpacing: 2.2 * k, color: c.passLabel }}>
          {lista ? "RECOMPENSA LISTA" : "PRÓXIMA RECOMPENSA"}
        </div>
        <div
          style={{
            position: "absolute",
            left: pad,
            top: 33 * k,
            width: width - pad * 2,
            display: "flex",
            fontFamily: marca,
            fontSize: premio.size * k,
            lineHeight: 1.15,
            letterSpacing: upper ? premio.size * 0.05 * k : 0,
            textTransform: upper ? "uppercase" : "none",
            ...(premio.lines === 1 ? { whiteSpace: "nowrap" as const } : {}),
          }}
        >
          {premio.text}
        </div>

        {/* El hilo */}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
          {h.hilos.map((d) => (
            <path key={d} d={d} fill="none" stroke={linea} strokeWidth={h.trazo} />
          ))}
        </svg>

        {/* Los sellos */}
        {h.sellos.map((s) => {
          const ganado = s.index < stamps;
          if (s.premio) {
            return (
              <div key={s.index} style={{ ...circulo(s.x, s.y, h.aro), border: `${h.trazo}px solid ${linea}` }}>
                <div
                  style={{
                    width: s.r * 2,
                    height: s.r * 2,
                    borderRadius: s.r,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: lista ? c.accent : c.bg,
                    border: `${1.3 * h.trazo}px solid ${c.accent}`,
                  }}
                >
                  <Icon name="gift" size={s.r * 1.05} color={lista ? c.onAccent : c.accent} />
                </div>
              </div>
            );
          }
          return (
            <div
              key={s.index}
              style={{
                ...circulo(s.x, s.y, s.r),
                background: ganado ? c.accent : c.bg,
                border: ganado ? "none" : `${1.1 * h.trazo}px solid ${alpha(c.accent, 0.6)}`,
              }}
            >
              {/* Cada sello ganado lleva el sello del comercio: su imagen (o su logo) o el icono elegido */}
              {ganado &&
                (stampUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                  <img src={stampUrl} width={s.r * 1.8} height={s.r * 1.8} style={{ borderRadius: s.r, background: "#ffffff", objectFit: "contain", padding: s.r * 0.16 }} />
                ) : (
                  <Icon name={branding.stampIcon ?? "check"} size={s.r * 1.1} color={c.onAccent} />
                ))}
            </div>
          );
        })}
      </div>
    ),
    { width, height, headers: opts.headers, fonts: opts.fonts },
  );
}
