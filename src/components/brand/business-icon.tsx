import { ImageResponse } from "next/og";
import type { BusinessBranding } from "@/lib/domain/types";

export interface IconBusiness {
  name: string;
  branding: Pick<BusinessBranding, "cardBackground" | "cardForeground" | "logoText" | "logoUrl">;
}

/**
 * Icono del comercio: su logo (o iniciales) en un círculo sobre sus colores.
 * Lo usan el icono de la tarjeta instalada y las imágenes del pase de Apple Wallet.
 * `transparent` quita el fondo y el círculo ocupa todo (logo del pase de Apple).
 */
export function businessIcon(business: IconBusiness | null, size: number, opts: { headers?: Record<string, string>; transparent?: boolean } = {}) {
  const bg = business?.branding.cardBackground ?? "#EBCFCB";
  const fg = business?.branding.cardForeground ?? "#1A1416";
  const text = (business?.branding.logoText || business?.name.slice(0, 2) || "LC").slice(0, 3);
  const logo = business?.branding.logoUrl?.startsWith("https://") ? business.branding.logoUrl : null;
  const circle = opts.transparent ? size : size * 0.62;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: opts.transparent ? "transparent" : bg }}>
        <div
          style={{
            width: circle,
            height: circle,
            borderRadius: "50%",
            background: logo ? "#ffffff" : fg,
            color: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            fontSize: circle * 0.39,
            fontFamily: "serif",
            letterSpacing: circle * 0.016,
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            // La imagen llena el círculo; las esquinas se recortan.
            <img src={logo} width={circle} height={circle} style={{ objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            text
          )}
        </div>
      </div>
    ),
    { width: size, height: size, headers: opts.headers },
  );
}

/**
 * Logo del pase de Apple Wallet (máx. 160 × 50 puntos): el logo en un círculo y el nombre
 * del comercio con su tipografía ("Marca"), como una marca impresa. Reemplaza al texto
 * del sistema que Apple pone junto al logo.
 */
export function businessWordmark(
  business: IconBusiness & { branding: IconBusiness["branding"] & { font?: string } },
  width: number,
  height: number,
  opts: { color: string; upper: boolean; fonts?: { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" }[] },
) {
  const fg = business.branding.cardForeground ?? "#1A1416";
  const bg = business.branding.cardBackground ?? "#EBCFCB";
  const logo = business.branding.logoUrl?.startsWith("https://") ? business.branding.logoUrl : null;
  const d = Math.round(height * 0.78);
  const name = business.name.trim();
  const brand = opts.fonts?.some((f) => f.name === "Marca") ? "Marca" : undefined;
  // El nombre se achica para que quepa en una línea al lado del logo.
  const room = width - d - height * 0.25;
  const size = Math.min(height * 0.46, (room / Math.max(name.length, 4)) * (opts.upper ? 1.55 : 1.9));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "transparent" }}>
        <div
          style={{
            width: d,
            height: d,
            borderRadius: d,
            flexShrink: 0,
            background: logo ? "#ffffff" : fg,
            color: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            fontSize: d * 0.38,
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={logo} width={d} height={d} style={{ objectFit: "cover", borderRadius: d }} />
          ) : (
            (business.branding.logoText || name.slice(0, 2)).slice(0, 3)
          )}
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: height * 0.22,
            fontSize: size,
            color: opts.color,
            fontFamily: brand,
            letterSpacing: opts.upper ? size * 0.08 : 0,
            textTransform: opts.upper ? "uppercase" : "none",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      </div>
    ),
    { width, height, fonts: opts.fonts },
  );
}
