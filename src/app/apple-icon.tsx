import { ImageResponse } from "next/og";

/** Ícono en PNG para iPhone y para el logo de Lazo en los datos de Google (piden PNG de 112 px o más). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const ARO = "M53 25C50 32 43 34 34 35A16.5 14 0 1 0 10 55A16.5 14 0 1 0 34 35";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1b3fd8" }}>
        <svg width="120" height="128" viewBox="0 0 60 64">
          <path d={ARO} fill="none" stroke="#ffc928" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
