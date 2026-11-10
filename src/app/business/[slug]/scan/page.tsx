"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, Gift, Loader2, PartyPopper, MapPin, Search, Shuffle, Tag, X } from "lucide-react";
import { activePromotion } from "@/lib/domain/promotions";
import { QrScanner } from "@/components/loyalty/qr-scanner";
import { useScope } from "@/components/business/business-shell";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { useDemo } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import { getProgress } from "@/lib/domain/loyalty-engine";
import { Avatar, Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { cn, formatDate, formatRelative } from "@/lib/utils";

/** Extrae el token público de una URL /card/<token> o de un token pegado. */
function parseToken(raw: string) {
  const v = raw.trim();
  const m = v.match(/\/card\/([A-Za-z0-9_-]{16,})/);
  return m ? m[1] : /^[A-Za-z0-9_-]{16,}$/.test(v) ? v : null;
}

type Feedback =
  | { kind: "visit"; rewardEarned: boolean; bonus: number; birthday: boolean }
  | { kind: "redeem"; rewardName: string }
  | { kind: "error"; message: string };

export default function ScanPage() {
  const scope = useScope();
  const { registerVisit, redeemReward, mode } = useDemo();
  const { business, program, customers, cards, rewards, membership, promotions, locations } = scope;
  const activeLocations = locations.filter((l) => l.active);
  const [locationId, setLocationId] = useState<string>("");
  // Recuerda la sede elegida en este dispositivo (cada caja suele estar en una sede).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`scan-location:${business.id}`);
      if (saved && activeLocations.some((l) => l.id === saved)) setLocationId(saved);
      else if (activeLocations.length === 1) setLocationId(activeLocations[0].id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, activeLocations.length]);
  const chooseLocation = (id: string) => {
    setLocationId(id);
    try {
      localStorage.setItem(`scan-location:${business.id}`, id);
    } catch {}
  };
  const promo = activePromotion(promotions, new Date(), business.timezone);

  const [query, setQuery] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [opKey, setOpKey] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [scanning, setScanning] = useState(false);
  const [visitDone, setVisitDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const card = cards.find((c) => c.id === cardId);
  const customer = card && customers.find((c) => c.id === card.customerId);
  const cardRewards = rewards.filter((r) => r.cardId === cardId && r.status === "available");
  const canRedeem = !!membership && can(membership, "rewards.redeem");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const token = parseToken(query);
    if (token) return cards.filter((c) => c.publicToken === token).map((c) => ({ card: c, customer: customers.find((x) => x.id === c.customerId)! }));
    const digits = q.replace(/\D/g, "");
    return customers
      .filter((c) => c.fullName.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 6)
      .map((c) => ({ customer: c, card: cards.find((k) => k.customerId === c.id)! }))
      .filter((r) => r.card);
  }, [query, cards, customers]);

  const select = (id: string) => {
    setCardId(id);
    setOpKey(crypto.randomUUID()); // una clave de idempotencia por operación
    setFeedback(null);
    setVisitDone(false);
    setScanError(null);
    setCameraOn(false);
    setQuery("");
  };

  // Lectura de la cámara: el QR contiene la URL /card/<token>. Solo se aceptan tarjetas de este comercio
  // (las de otros comercios ni siquiera llegan al navegador por RLS).
  const onScan = (text: string) => {
    const token = parseToken(text);
    const found = token && cards.find((c) => c.publicToken === token);
    if (found) select(found.id);
    else setScanError("Código no reconocido: no es una tarjeta de este comercio.");
  };

  const simulateScan = () => {
    setScanning(true);
    // Simula la lectura de un QR: elige una tarjeta activa al azar.
    const candidates = cards.filter((c) => c.status !== "blocked");
    setTimeout(() => {
      setScanning(false);
      select(candidates[Math.floor(Math.random() * candidates.length)].id);
    }, 1100);
  };

  const confirmVisit = async () => {
    if (!card || saving) return;
    setSaving(true);
    const res = await registerVisit(card.id, opKey, locationId || undefined);
    setSaving(false);
    if (res.ok) {
      setFeedback({ kind: "visit", rewardEarned: !!res.data?.reward, bonus: res.data?.bonusStamps ?? 0, birthday: !!res.data?.birthdayReward });
      setVisitDone(true);
    } else setFeedback({ kind: "error", message: res.message });
  };

  const redeem = async (rewardId: string, name: string) => {
    if (redeeming) return;
    setRedeeming(rewardId);
    const res = await redeemReward(rewardId);
    setRedeeming(null);
    setFeedback(res.ok ? { kind: "redeem", rewardName: name } : { kind: "error", message: res.message });
  };

  if (!program) return null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Registrar visita" description="Busca al cliente por nombre o teléfono. Si te muestra un código QR, también puedes escanearlo." />

      {activeLocations.length > 1 && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted" />
          <span className="text-muted">Sede:</span>
          <select value={locationId} onChange={(e) => chooseLocation(e.target.value)} className="h-9 flex-1 rounded-lg border border-line-strong bg-surface px-2">
            <option value="">Elige la sede donde estás</option>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {promo && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
          <Tag className="size-4 shrink-0" />
          <span>
            Hoy: <strong>{promo.name}</strong>. Cada visita suma {1 + promo.bonusStamps} sellos.
          </span>
        </div>
      )}

      {!card ? (
        <>
          {/* Escáner con la cámara del dispositivo */}
          <Card className="overflow-hidden">
            <div className="relative aspect-[4/3] bg-[#111] sm:aspect-video">
              {cameraOn && <QrScanner onResult={onScan} />}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.45))]" />
              <div className="pointer-events-none absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 sm:size-52">
                {["top-0 left-0 border-t-2 border-l-2 rounded-tl-xl", "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl"].map((c) => (
                  <span key={c} className={cn("absolute size-8 border-white/90", c)} />
                ))}
                {(scanning || cameraOn) && <span className="animate-scan absolute inset-x-3 h-0.5 rounded bg-brand-accent shadow-[0_0_12px_2px] shadow-brand-accent/60" />}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 p-4">
                <Button variant="secondary" onClick={() => { setScanError(null); setCameraOn((v) => !v); }} className="bg-white/95">
                  <Camera className="size-4" /> {cameraOn ? "Detener cámara" : "Escanear con la cámara"}
                </Button>
                {mode === "demo" && !cameraOn && (
                  <Button variant="secondary" onClick={simulateScan} disabled={scanning} className="bg-white/80">
                    <Shuffle className="size-4" /> {scanning ? "Leyendo…" : "Simular"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
          {scanError && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
              <AlertCircle className="size-4 shrink-0" /> {scanError}
            </p>
          )}

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, teléfono o enlace de tarjeta"
              className="h-11 pl-9"
            />
          </div>
          {results.length > 0 && (
            <Card className="mt-2 divide-y divide-line">
              {results.map(({ customer: c, card: k }) => (
                <button key={k.id} onClick={() => select(k.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas">
                  <Avatar name={c.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.fullName}</p>
                    <p className="text-xs text-muted">{c.phone}</p>
                  </div>
                  <span className="tabular text-xs font-medium text-muted">
                    {k.currentStamps}/{program.stampsRequired}
                  </span>
                </button>
              ))}
            </Card>
          )}
          {query.length >= 2 && results.length === 0 && <p className="mt-3 text-center text-sm text-muted">Sin resultados.</p>}
        </>
      ) : (
        <div className="animate-fade-up space-y-4">
          <button onClick={() => setCardId(null)} className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Escanear otra tarjeta
          </button>

          {feedback && (
            <div
              className={cn(
                "animate-fade-up flex items-start gap-3 rounded-xl border p-4 text-sm",
                feedback.kind === "error" ? "border-danger/20 bg-danger-bg text-danger" : "border-success/20 bg-success-bg text-success",
              )}
            >
              {feedback.kind === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : feedback.kind === "visit" && feedback.rewardEarned ? <PartyPopper className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
              <div className="flex-1">
                {feedback.kind === "error" && feedback.message}
                {feedback.kind === "visit" &&
                  (feedback.rewardEarned ? (
                    <>
                      <p className="font-semibold">¡{customer?.fullName.split(" ")[0]} completó su tarjeta!</p>
                      <p>Ganó: {program.rewardName}. Puede canjearla ahora o en su próxima visita.</p>
                    </>
                  ) : (
                    <p className="font-semibold">
                      Visita registrada{feedback.bonus > 0 ? `: +${1 + feedback.bonus} sellos por la promoción` : ""}. La tarjeta del cliente ya está actualizada.
                    </p>
                  ))}
                {feedback.kind === "visit" && feedback.bonus > 0 && feedback.rewardEarned && <p>Incluye {feedback.bonus} sello(s) extra por la promoción.</p>}
                {feedback.kind === "visit" && feedback.birthday && (
                  <p className="mt-1 font-semibold">🎂 ¡Es su mes de cumpleaños! Recibió: {program.birthdayReward}. Aparece en sus recompensas.</p>
                )}
                {feedback.kind === "redeem" && <p className="font-semibold">Canje registrado: {feedback.rewardName}.</p>}
              </div>
              <button onClick={() => setFeedback(null)} aria-label="Cerrar">
                <X className="size-4 opacity-60" />
              </button>
            </div>
          )}

          {customer && (
            <LoyaltyCardView
              compact
              business={business}
              program={program}
              customerName={customer.fullName}
              stamps={card.currentStamps}
              status={card.status}
              rewardsAvailable={getProgress(card, program, rewards).rewardsAvailable}
              highlightLastStamp={feedback?.kind === "visit"}
            />
          )}

          <Card className="p-4">
            <dl className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <dt className="text-xs text-muted">Visitas totales</dt>
                <dd className="tabular mt-0.5 font-semibold">{card.totalVisits}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Última visita</dt>
                <dd className="mt-0.5 font-semibold">{formatRelative(card.lastVisitAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Cliente desde</dt>
                <dd className="mt-0.5 font-semibold">{formatDate(customer?.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          {card.status === "blocked" ? (
            <div className="rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger">Esta tarjeta está bloqueada y no admite movimientos.</div>
          ) : (
            <Button
              variant="brand"
              size="lg"
              className="h-14 w-full text-base"
              onClick={confirmVisit}
              disabled={visitDone || saving}
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              {visitDone ? "Visita registrada" : `Confirmar visita (+${1 + (promo?.bonusStamps ?? 0)} ${promo ? "sellos" : "sello"})`}
            </Button>
          )}

          {cardRewards.length > 0 && (
            <Card>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Gift className="size-4" /> Recompensas disponibles
                </p>
                <Badge tone="brand">{cardRewards.length}</Badge>
              </div>
              <ul className="divide-y divide-line">
                {cardRewards.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted">
                        Obtenida {formatRelative(r.earnedAt)}
                        {r.expiresAt && ` · vence ${formatDate(r.expiresAt)}`}
                      </p>
                    </div>
                    {canRedeem ? (
                      <Button size="sm" variant="primary" disabled={!!redeeming} onClick={() => redeem(r.id, r.name)}>
                        {redeeming === r.id && <Loader2 className="size-3.5 animate-spin" />} Canjear
                      </Button>
                    ) : (
                      <span className="text-xs text-muted">Sin permiso de canje</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {customer && (
            <p className="text-center text-xs text-muted">
              <Link href={`/business/${business.slug}/customers/${customer.id}`} className="underline">
                Ver historial completo
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
