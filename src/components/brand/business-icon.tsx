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
            fontSize: circle * 0.39,
            fontFamily: "serif",
            letterSpacing: circle * 0.016,
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={logo} width={circle * 0.71} height={circle * 0.71} style={{ objectFit: "contain" }} />
          ) : (
            text
          )}
        </div>
      </div>
    ),
    { width: size, height: size, headers: opts.headers },
  );
}
