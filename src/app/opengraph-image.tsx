import { ImageResponse } from "next/og";

/** Imagen que sale al compartir el enlace (WhatsApp, Facebook, LinkedIn, X). Se genera al compilar. */
export const alt = "Lazo: tarjeta de sellos digital con la marca de tu negocio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const AZUL = "#1b3fd8";
const SOL = "#ffc928";
const ARO = "M53 25C50 32 43 34 34 35A16.5 14 0 1 0 10 55A16.5 14 0 1 0 34 35";

/** Descarga la letra de la marca (Bricolage Grotesque) solo con los caracteres de la imagen. Si falla, usa la letra por defecto. */
async function letraDeMarca(texto: string, peso: number) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@${peso}&text=${encodeURIComponent(texto)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

const TITULO = "Tarjeta de sellos digital para que tus clientes vuelvan";
const LINEA = "Con tu marca · En Google Wallet · Sellos con NFC";

export default async function OpengraphImage() {
  const [gruesa, media] = await Promise.all([letraDeMarca(`Laz${TITULO}`, 800), letraDeMarca(LINEA, 600)]);
  const fonts = [
    ...(gruesa ? [{ name: "Bricolage", data: gruesa, weight: 800 as const, style: "normal" as const }] : []),
    ...(media ? [{ name: "Bricolage", data: media, weight: 600 as const, style: "normal" as const }] : []),
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: AZUL, color: "#fff", fontFamily: fonts.length ? "Bricolage" : undefined, padding: "72px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 120, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>
          <span>Laz</span>
          <svg width="112" height="120" viewBox="0 0 60 64" style={{ marginLeft: 4 }}>
            <path d={ARO} fill="none" stroke={SOL} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            {TITULO}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: SOL, fontWeight: 600 }}>{LINEA}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
