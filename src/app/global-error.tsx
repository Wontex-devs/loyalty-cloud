"use client";

import { useEffect } from "react";
import { avisarError } from "@/lib/avisar-error";

/** Error grave que tumba toda la página (incluido el diseño general). Se avisa y se ofrece recargar. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    avisarError(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Algo salió mal</p>
          <p style={{ marginTop: 4, fontSize: 14, color: "#555" }}>No se perdió ningún dato. Recarga la página para seguir.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, height: 40, borderRadius: 8, background: "#111", color: "#fff", padding: "0 16px", fontSize: 14, border: 0 }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
