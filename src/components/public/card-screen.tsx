"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cake, Check, Copy, Gift, PartyPopper, Share2, Sparkles, Nfc } from "lucide-react";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { InstallCard } from "./install-card";
import { WalletButtons } from "./wallet-buttons";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { formatDate, formatRelative } from "@/lib/utils";
import type { BusinessBranding, CardStatus } from "@/lib/domain/types";

/** Datos que necesita la tarjeta pública. Coincide con lo que devuelve get_public_card. */
export interface PublicCardData {
  token: string;
  status: CardStatus;
  stamps: number;
  totalVisits: number;
  customerName: string;
  memberSince: string;
  business: { name: string; slug?: string; branding: BusinessBranding };
  program: { name: string; stampsRequired: number; rewardName: string; terms: string };
  rewards: { name: string; kind?: "cycle" | "birthday"; expiresAt?: string | null }[];
  recent: { kind: "visit" | "reversal"; delta: number; bonus?: number; createdAt: string }[];
  /** Promoción vigente hoy en el comercio (p. ej. doble sello). */
  promotion?: { name: string; bonusStamps: number } | null;
  /** La clienta aceptó recibir mensajes: se le ofrece darse de baja. */
  marketingConsent?: boolean;
}

/** Página de la tarjeta del cliente. En modo live se refresca sola mientras está visible. */
export function CardScreen({
  data,
  isNew,
  live,
  googleWallet = false,
  onUnsubscribe,
}: {
  data: PublicCardData;
  isNew?: boolean;
  live?: boolean;
  googleWallet?: boolean;
  /** Retira el consentimiento de marketing de esta tarjeta. */
  onUnsubscribe?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [unsub, setUnsub] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const [bump, setBump] = useState(false);
  const lastVisits = useRef(data.totalVisits);
  const b = data.business.branding;

  useEffect(() => setUrl(`${window.location.origin}/card/${data.token}`), [data.token]);

  // Guarda el enlace de la tarjeta en este celular: la pantalla del toque NFC (/tap) lo usa para saber quién es.
  useEffect(() => {
    if (!data.business.slug || !live) return;
    try {
      localStorage.setItem(`lazo:tarjeta:${data.business.slug}`, data.token);
    } catch {
      /* sin almacenamiento: el toque pedirá abrir la tarjeta de nuevo */
    }
  }, [data.business.slug, data.token, live]);

  // Animación cuando el empleado suma una visita.
  useEffect(() => {
    if (data.totalVisits > lastVisits.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 3000);
      lastVisits.current = data.totalVisits;
      return () => clearTimeout(t);
    }
    lastVisits.current = data.totalVisits;
  }, [data.totalVisits]);

  // Live: el cliente suele tener la tarjeta abierta en caja; se consulta de nuevo cada pocos segundos.
  useEffect(() => {
    if (!live) return;
    let last = 0;
    const tick = () => {
      // Como mucho una consulta cada 4 s, y solo con la pestaña visible.
      if (document.visibilityState !== "visible" || Date.now() - last < 4000) return;
      last = Date.now();
      router.refresh();
    };
    const id = setInterval(tick, 6000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, router]);

  const copy = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Mi tarjeta ${data.business.name}`, url });
      } catch {}
    } else copy();
  };

  return (
    <div className="min-h-dvh" style={{ background: `linear-gradient(180deg, ${b.cardBackground}55 0%, #f6f6f6 45%)` }}>
      <div className="mx-auto max-w-md px-4 pt-6 pb-10">
        {isNew && (
          <div className="animate-fade-up mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-card">
            <PartyPopper className="size-5 shrink-0" style={{ color: b.primary }} />
            <div>
              <p className="font-semibold">¡Te damos la bienvenida a {data.program.name}!</p>
              <p className="text-muted">
                {data.stamps > 0 && data.totalVisits === 0 ? `Ya tienes ${data.stamps} ${data.stamps === 1 ? "sello" : "sellos"} de regalo. ` : ""}
                Guarda este enlace o añádelo a tu pantalla de inicio.
              </p>
            </div>
          </div>
        )}
        {bump && (
          <div className="animate-fade-up mb-4 flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold text-white shadow-pop" style={{ background: b.cardForeground }}>
            <Check className="size-5" /> ¡Visita sumada! Gracias por volver.
          </div>
        )}

        {data.promotion && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-card">
            <Sparkles className="size-5 shrink-0" style={{ color: b.cardForeground }} />
            <p>
              <strong>Hoy: {data.promotion.name}.</strong> Tu visita de hoy suma {1 + data.promotion.bonusStamps} sellos.
            </p>
          </div>
        )}

        <LoyaltyCardView
          business={data.business}
          program={data.program}
          customerName={data.customerName}
          stamps={Math.min(data.stamps, data.program.stampsRequired)}
          status={data.status}
          rewardsAvailable={data.rewards.length}
          memberSince={formatDate(data.memberSince)}
          highlightLastStamp={bump}
        />

        {data.status !== "blocked" && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-card">
            <Nfc className="size-6 shrink-0" style={{ color: b.cardForeground }} aria-hidden />
            <p>
              <span className="font-semibold">Para sumar tu sello</span>, acerca tu celular a la etiqueta del mostrador. Si no tiene etiqueta, da tu nombre en
              caja.
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={share} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium shadow-card">
            <Share2 className="size-4" /> Compartir
          </button>
          <button onClick={copy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium shadow-card">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copiado" : "Copiar enlace"}
          </button>
        </div>

        {data.status !== "blocked" && <WalletButtons token={data.token} google={googleWallet} />}
        <InstallCard color={b.cardForeground} />

        {data.rewards.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase">Tus recompensas</h2>
            <ul className="space-y-2">
              {data.rewards.map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex size-10 items-center justify-center rounded-full" style={{ background: b.cardBackground, color: b.cardForeground }}>
                    {r.kind === "birthday" ? <Cake className="size-5" /> : <Gift className="size-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {r.name}
                      {r.kind === "birthday" && " · ¡Feliz cumpleaños!"}
                    </p>
                    <p className="text-xs text-muted">{r.expiresAt ? `Válida hasta ${formatDate(r.expiresAt)}` : "Sin vencimiento"} · muestra tu QR para canjear</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase">Últimos movimientos</h2>
          <div className="divide-y divide-line rounded-2xl bg-white shadow-card">
            {data.recent.length === 0 && <p className="p-4 text-sm text-muted">Aún no tienes visitas. ¡Te esperamos!</p>}
            {data.recent.map((v, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{v.kind === "visit" ? "Visita" : "Corrección"}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted">{formatRelative(v.createdAt)}</span>
                  <span className={v.delta > 0 ? "font-semibold" : "font-semibold text-warning"}>{v.delta > 0 ? `+${1 + (v.bonus ?? 0)}` : "−1"}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-6 px-2 text-center text-[11px] leading-relaxed text-muted">{data.program.terms}</p>
        {data.business.slug && (
          <p className="mt-2 text-center text-[11px]">
            <a href={`/join/${data.business.slug}/terminos`} className="text-muted underline">
              Términos y tratamiento de datos
            </a>
          </p>
        )}
        {onUnsubscribe && (data.marketingConsent || unsub === "done") && (
          <div className="mt-2 text-center text-[11px] text-muted">
            {unsub === "done" ? (
              <p>Listo: {data.business.name} ya no te enviará promociones. Tu tarjeta sigue igual.</p>
            ) : unsub === "confirm" || unsub === "busy" || unsub === "error" ? (
              <p>
                {unsub === "error" ? "No se pudo completar. " : "¿Dejar de recibir promociones y novedades? "}
                <button
                  type="button"
                  disabled={unsub === "busy"}
                  className="font-semibold underline"
                  onClick={async () => {
                    setUnsub("busy");
                    setUnsub((await onUnsubscribe()) ? "done" : "error");
                  }}
                >
                  {unsub === "busy" ? "Un momento…" : unsub === "error" ? "Reintentar" : "Sí, no quiero mensajes"}
                </button>{" "}
                {unsub !== "busy" && (
                  <button type="button" className="underline" onClick={() => setUnsub("idle")}>
                    Cancelar
                  </button>
                )}
              </p>
            ) : (
              <button type="button" className="underline" onClick={() => setUnsub("confirm")}>
                No quiero recibir promociones
              </button>
            )}
          </div>
        )}
        <p className="mt-4 flex items-baseline justify-center gap-1 text-[11px] text-subtle">Tecnología de <LazoLogo className="text-[13px]" /></p>
      </div>
    </div>
  );
}

export function NotFoundScreen({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
