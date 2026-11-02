"use client";

import { useEffect } from "react";

/** Error inesperado en cualquier pantalla: mensaje claro y opción de reintentar, sin detalles técnicos. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">Algo salió mal</p>
        <p className="mt-1 text-sm text-muted">No se perdió ningún dato. Revisa tu conexión e inténtalo de nuevo.</p>
        <button onClick={() => retry()} className="mt-5 h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">
          Reintentar
        </button>
      </div>
    </div>
  );
}
