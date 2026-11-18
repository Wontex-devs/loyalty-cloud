"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { walletStatusAction, type WalletStatusResult } from "@/lib/data/wallet-status-actions";
import { WALLET_LABEL, type WalletKind } from "@/lib/wallet/invite";

export type WalletStatus = { loading: true } | { loading: false; ok: false } | { loading: false; ok: true; byCard: Record<string, WalletKind[]>; googleChecked: boolean };

/** Estado de billetera de todas las tarjetas del comercio (se consulta al abrir la página). */
export function useWalletStatus(businessId: string): WalletStatus {
  const [state, setState] = useState<WalletStatus>({ loading: true });
  useEffect(() => {
    let alive = true;
    walletStatusAction(businessId)
      .then((r: WalletStatusResult) => alive && setState(r.ok ? { loading: false, ok: true, byCard: r.byCard, googleChecked: r.googleChecked } : { loading: false, ok: false }))
      .catch(() => alive && setState({ loading: false, ok: false }));
    return () => {
      alive = false;
    };
  }, [businessId]);
  return state;
}

/** Billeteras de una tarjeta: [] = no la tiene; null = no se sabe (cargando o error). */
export function walletsOf(status: WalletStatus, cardId: string): WalletKind[] | null {
  if (status.loading || !status.ok) return null;
  return status.byCard[cardId] ?? [];
}

export function WalletBadge({ wallets, className, fallo }: { wallets: WalletKind[] | null; className?: string; fallo?: boolean }) {
  // Sin dato: mientras consulta se dice; si la consulta falló, una raya en vez de «…» eternos.
  if (wallets === null)
    return (
      <span className={cn("text-xs text-subtle", className)} title={fallo ? "No se pudo consultar la billetera en este momento" : undefined}>
        {fallo ? "—" : "Consultando…"}
      </span>
    );
  if (!wallets.length)
    return (
      <Badge tone="neutral" className={className}>
        Sin guardar
      </Badge>
    );
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {wallets.map((w) => (
        <Badge key={w} tone="success">
          <Wallet className="size-3" /> {WALLET_LABEL[w]}
        </Badge>
      ))}
    </span>
  );
}
