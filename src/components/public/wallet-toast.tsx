"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet, X } from "lucide-react";

/**
 * Notificación simulada de la billetera (solo en la demo): así se ve en el celular
 * el aviso que el comercio envía o que sale solo al registrar una visita.
 */
export function WalletToast({ notice, businessName }: { notice?: { id: string; title: string; body: string; createdAt: string }; businessName: string }) {
  const [shown, setShown] = useState<typeof notice | null>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!notice || seen.current === notice.id) return;
    const first = seen.current === null;
    seen.current = notice.id;
    // Al abrir la tarjeta solo se muestra si el aviso es de hace un momento.
    if (first && Date.now() - new Date(notice.createdAt).getTime() > 2 * 60_000) return;
    setShown(notice);
    const t = setTimeout(() => setShown(null), 9000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!shown) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-black/5 bg-white/95 p-3.5 shadow-pop backdrop-blur"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
          <Wallet className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted">Billetera · {businessName} · ahora</p>
          <p className="text-sm font-semibold leading-snug">{shown.title}</p>
          <p className="text-[13px] leading-snug text-ink/80">{shown.body}</p>
        </div>
        <button type="button" aria-label="Cerrar" onClick={() => setShown(null)} className="text-muted">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
