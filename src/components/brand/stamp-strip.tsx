import { ImageResponse } from "next/og";
import { alpha, cardTheme } from "@/lib/domain/card-palette";
import type { BusinessBranding, StampIcon } from "@/lib/domain/types";

/** Trazos de los iconos de sello (Lucide, 24×24) para dibujarlos sin React en la imagen. */
type Shape = ["path", { d: string }] | ["circle", { cx: number; cy: number; r: number }] | ["rect", { x: number; y: number; width: number; height: number; rx: number }];
const ICONS: Record<StampIcon | "gift", { shapes: Shape[]; filled?: boolean }> = {
  check: { shapes: [["path", { d: "M20 6 9 17l-5-5" }]] },
  heart: {
    filled: true,
    shapes: [["path", { d: "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" }]],
  },
  star: {
    filled: true,
    shapes: [
      [
        "path",
        {
          d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
        },
      ],
    ],
  },
  sparkles: {
    shapes: [
      ["path", { d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" }],
      ["path", { d: "M20 2v4" }],
      ["path", { d: "M22 4h-4" }],
      ["circle", { cx: 4, cy: 20, r: 2 }],
    ],
  },
  flower: {
    shapes: [
      ["path", { d: "M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1" }],
      ["circle", { cx: 12, cy: 8, r: 2 }],
      ["path", { d: "M12 10v12" }],
      ["path", { d: "M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z" }],
      ["path", { d: "M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z" }],
    ],
  },
  gem: {
    shapes: [
      ["path", { d: "M10.5 3 8 9l4 13 4-13-2.5-6" }],
      ["path", { d: "M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" }],
      ["path", { d: "M2 9h20" }],
    ],
  },
  crown: {
    shapes: [
      ["path", { d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" }],
      ["path", { d: "M5 21h14" }],
    ],
  },
  scissors: {
    shapes: [
      ["circle", { cx: 6, cy: 6, r: 3 }],
      ["path", { d: "M8.12 8.12 12 12" }],
      ["path", { d: "M20 4 8.12 15.88" }],
      ["circle", { cx: 6, cy: 18, r: 3 }],
      ["path", { d: "M14.8 14.8 20 20" }],
    ],
  },
  gift: {
    shapes: [
      ["path", { d: "M12 7v14" }],
      ["path", { d: "M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" }],
      ["path", { d: "M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" }],
      ["rect", { x: 3, y: 7, width: 18, height: 4, rx: 1 }],
    ],
  },
};

function Icon({ name, size, color }: { name: StampIcon | "gift"; size: number; color: string }) {
  const icon = ICONS[name] ?? ICONS.check;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={icon.filled ? color : "none"} stroke={color} strokeWidth={name === "check" ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
      {icon.shapes.map(([tag, attrs], i) =>
        tag === "path" ? <path key={i} {...attrs} /> : tag === "circle" ? <circle key={i} {...attrs} /> : <rect key={i} {...attrs} />,
      )}
    </svg>
  );
}

export interface StripInput {
  branding: Pick<BusinessBranding, "cardBackground" | "cardForeground" | "stampIcon" | "stampUrl" | "cardStyle" | "coverUrl">;
  stamps: number;
  required: number;
  /** Título grande de la franja (p. ej. el nombre del club). */
  title?: string;
  /** Línea pequeña sobre el título (p. ej. el nombre del comercio). */
  kicker?: string;
}

/** Filas y columnas de sellos para la zona derecha de la franja. */
export function stripGrid(required: number) {
  const rows = required <= 5 ? 1 : required <= 12 ? 2 : 3;
  return { rows, cols: Math.ceil(required / rows) };
}

/** Tamaño del título según lo largo que sea, para que quepa en dos líneas. */
const titleSize = (t: string) => (t.length <= 12 ? 26 : t.length <= 18 ? 22 : t.length <= 26 ? 18 : 15);

/**
 * Franja del pase (PNG), al estilo de una revista: foto del local con velo, un arco fino,
 * el título en letra elegante a la izquierda y los sellos a la derecha.
 * Va en el pase de Apple Wallet (strip) y como imagen principal del pase de Google Wallet.
 * `fonts` son las letras ya descargadas ("Titulo"); sin ellas se usa la letra por defecto.
 */
export function stampStrip(
  { branding, stamps, required, title, kicker }: StripInput,
  width: number,
  height: number,
  opts: { headers?: Record<string, string>; fonts?: { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" }[] } = {},
) {
  const c = cardTheme(branding);
  const k = height / 144; // escala: la franja de Apple mide 144 puntos de alto
  const photo = c.photo !== "none" && branding.coverUrl?.startsWith("https://") ? branding.coverUrl : null;
  const ink = photo ? "#FFFFFF" : c.text;
  const soft = photo ? "rgba(255,255,255,0.82)" : c.muted;
  const stampUrl = branding.stampUrl?.startsWith("https://") ? branding.stampUrl : null;
  const icon = branding.stampIcon ?? "check";
  const hasTitle = !!title;
  const titleFont = opts.fonts?.some((f) => f.name === "Titulo") ? "Titulo" : undefined;

  // Zona de sellos: a la derecha si hay título; si no, centrada en toda la franja.
  const area = hasTitle ? width * 0.4 : width * 0.88;
  const { rows, cols } = stripGrid(required);
  const gap = 7 * k;
  const size = Math.floor(Math.min((area - gap * (cols - 1)) / cols, (height - 30 * k - gap * (rows - 1)) / rows));

  const circle = (i: number) => {
    const filled = i < stamps;
    const last = i === required - 1;
    const base = { width: size, height: size, borderRadius: size, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i % cols ? gap : 0 } as const;
    if (filled)
      return (
        <div
          key={i}
          style={{
            ...base,
            ...(c.accentCss.startsWith("linear") ? { backgroundImage: c.accentCss } : {}),
            backgroundColor: c.accent,
            boxShadow: `0 0 0 ${Math.round(size * 0.07)}px ${alpha(c.accent, 0.25)}, 0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.18)}px rgba(0,0,0,0.4)`,
          }}
        >
          {stampUrl ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={stampUrl} width={size * 0.86} height={size * 0.86} style={{ borderRadius: size, background: "#ffffff", objectFit: "contain", padding: size * 0.1 }} />
          ) : (
            <Icon name={icon} size={size * 0.48} color={c.onAccent} />
          )}
        </div>
      );
    if (last)
      return (
        <div key={i} style={{ ...base, background: photo ? "rgba(0,0,0,0.25)" : alpha(c.accent, 0.12), border: `${Math.max(2, 1.5 * k)}px solid ${c.ornament}` }}>
          <Icon name="gift" size={size * 0.46} color={c.ornament} />
        </div>
      );
    return (
      <div
        key={i}
        style={{
          ...base,
          background: photo ? "rgba(255,255,255,0.12)" : c.slot === "transparent" ? "transparent" : c.slot,
          border: `${Math.max(1, 1.2 * k)}px solid ${photo ? "rgba(255,255,255,0.45)" : c.slotBorder}`,
        }}
      />
    );
  };

  const grid = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "flex", marginTop: r ? gap : 0 }}>
          {Array.from({ length: cols }, (_, j) => r * cols + j)
            .filter((i) => i < required)
            .map(circle)}
        </div>
      ))}
    </div>
  );

  const full = { position: "absolute", top: 0, left: 0, width, height } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: c.bg, backgroundImage: c.bgCss.replace(/,\s*#[0-9A-F]{6}$/i, "") }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={photo} width={width} height={height} style={{ ...full, objectFit: "cover" }} />
        )}
        {/* Velo: tiñe la foto con el color de la tarjeta y oscurece la izquierda para el título */}
        {photo && c.style !== "marfil" && <div style={{ ...full, background: alpha(c.bg, c.photo === "full" ? 0.3 : 0.45) }} />}
        {photo && <div style={{ ...full, backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.18) 100%)" }} />}
        {/* Arco fino, como un sello de lujo */}
        <div
          style={{
            position: "absolute",
            left: width * (hasTitle ? 0.4 : 0.6),
            top: -height * 0.55,
            width: height * 2,
            height: height * 2,
            borderRadius: height * 2,
            border: `${Math.max(2, 1.6 * k)}px solid ${alpha(c.ornament, 0.85)}`,
          }}
        />
        {c.frame && <div style={{ position: "absolute", left: 0, bottom: 0, width, height: Math.max(2, Math.round(k * 1.5)), backgroundImage: c.frame }} />}

        {hasTitle && (
          <div style={{ position: "absolute", left: 18 * k, top: 0, height, width: width * 0.47, display: "flex", flexDirection: "column", justifyContent: "center", color: ink, fontFamily: titleFont }}>
            {kicker && (
              <div style={{ display: "flex", fontSize: 9 * k, letterSpacing: 2.6 * k, textTransform: "uppercase", color: photo ? alpha(c.ornament, 1) : c.label, fontFamily: titleFont, fontWeight: 600 }}>
                {kicker}
              </div>
            )}
            <div
              style={{
                display: "flex",
                marginTop: 4 * k,
                fontSize: titleSize(title!) * k,
                lineHeight: 1.02,
                letterSpacing: 0.8 * k,
                textTransform: "uppercase",
                fontFamily: titleFont,
                fontWeight: 500,
                textShadow: photo ? "0 2px 12px rgba(0,0,0,0.45)" : "none",
              }}
            >
              {title}
            </div>
            <div style={{ display: "flex", marginTop: 8 * k, fontSize: 9.5 * k, letterSpacing: 1.8 * k, textTransform: "uppercase", color: soft, fontWeight: 600 }}>
              {`${stamps} de ${required} sellos`}
            </div>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            height,
            ...(hasTitle ? { right: 16 * k, width: area } : { left: (width - area) / 2, width: area }),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {grid}
        </div>
      </div>
    ),
    { width, height, headers: opts.headers, fonts: opts.fonts },
  );
}
