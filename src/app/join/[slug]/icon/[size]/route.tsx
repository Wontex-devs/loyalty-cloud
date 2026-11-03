import { ImageResponse } from "next/og";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicBusiness } from "@/lib/data/public";

type Ctx = { params: Promise<{ slug: string; size: string }> };

const SIZES = new Set([180, 192, 512, 660]);

/** Icono de la app de la tarjeta: logo (o iniciales) del comercio sobre sus colores. */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug, size: raw } = await params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const business = isSupabaseConfigured && slug !== "_" ? await getPublicBusiness(slug) : null;
  const bg = business?.branding.cardBackground ?? "#EBCFCB";
  const fg = business?.branding.cardForeground ?? "#1A1416";
  const text = (business?.branding.logoText || business?.name.slice(0, 2) || "LC").slice(0, 3);
  const logo = business?.branding.logoUrl?.startsWith("https://") ? business.branding.logoUrl : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: bg }}>
        <div
          style={{
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: "50%",
            background: logo ? "#ffffff" : fg,
            color: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.24,
            fontFamily: "serif",
            letterSpacing: size * 0.01,
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={logo} width={size * 0.44} height={size * 0.44} style={{ objectFit: "contain" }} />
          ) : (
            text
          )}
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
