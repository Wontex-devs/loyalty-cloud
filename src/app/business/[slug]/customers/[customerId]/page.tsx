"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, BellOff, Cake, MessageCircle, CheckCircle2, Copy, ExternalLink, Gift, Loader2, Mail, Phone, Plus, RotateCcw, ShieldCheck, Stamp, Trash2, Undo2, UserX } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { CARD_STATUS } from "@/components/business/status";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import { getProgress } from "@/lib/domain/loyalty-engine";
import { Avatar, Badge, Button, ButtonLink, buttonClass, Card, CardHeader, EmptyState, Input, Select } from "@/components/ui";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { publicOrigin } from "@/lib/config";
import { greetingName } from "@/lib/wallet/messages";
import { cardMessage, whatsappUrl } from "@/lib/wallet/invite";
import { useWalletStatus, WalletBadge, walletsOf } from "@/components/business/wallet-status";

/** Motivos frecuentes para sumar una visita a mano (se pueden editar). */
const MOTIVOS_MANUAL = ["El toque NFC no funcionó", "El cliente no tenía el celular", "El celular del cliente estaba sin batería"];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];


export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const scope = useScope();
  const { reverseVisit, redeemReward, setCardBlocked, anonymizeCustomer, revokeMarketingConsent, registerManualVisit } = useData();
  const { business, program, customers, cards, visits, rewards, redemptions, membership, profiles, locations } = scope;
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualReason, setManualReason] = useState("");
  const activeLocations = locations.filter((l) => l.active);
  const [manualLocation, setManualLocation] = useState("");
  const wallet = useWalletStatus(business.id);

  const customer = customers.find((c) => c.id === customerId);
  const card = cards.find((c) => c.customerId === customerId);
  if (!customer || !card || !program)
    return <EmptyState icon={Stamp} title="Cliente no encontrado" action={<ButtonLink href={`/business/${business.slug}/customers`}>Volver</ButtonLink>} />;

  const progress = getProgress(card, program, rewards);
  const cardUrl = `${publicOrigin()}/card/${card.publicToken}`;
  const wallets = walletsOf(wallet, card.id);
  // El empleado lo envía desde su propio WhatsApp, uno a uno. Sin billetera, lo invita a guardarla.
  const needsInvite = wallets?.length === 0 && card.status !== "blocked";
  const whatsapp = whatsappUrl(customer.phone, cardMessage(greetingName(customer), business.name, cardUrl, !needsInvite));
  const reversedIds = new Set(visits.filter((v) => v.reversesVisitId).map((v) => v.reversesVisitId));
  const staffName = (id: string) => profiles.find((p) => p.id === id)?.fullName ?? "—";
  const canReverse = !!membership && can(membership, "visits.reverse") && !customer.anonymizedAt;
  const canRedeem = !!membership && can(membership, "rewards.redeem");
  const anonymized = !!customer.anonymizedAt;
  const canBlock = !!membership && membership.role !== "staff" && !anonymized;
  const canManageConsent = !!membership && membership.role !== "staff";
  const isOwner = membership?.role === "owner";
  const available = rewards.filter((r) => r.cardId === card.id && r.status === "available");
  const canAddVisit = !!membership && can(membership, "visits.create") && !anonymized && card.status !== "blocked";
  const locationForVisit = manualLocation || (activeLocations.length === 1 ? activeLocations[0].id : "");

  const run = async (key: string, op: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(key);
    const res = await op();
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.message ?? "No se pudo completar la operación." });
    return res.ok;
  };

  const timeline = [
    ...visits.filter((v) => v.cardId === card.id).map((v) => ({ type: v.kind, at: v.createdAt, visit: v })),
    ...rewards.filter((r) => r.cardId === card.id).map((r) => ({ type: "reward" as const, at: r.earnedAt, reward: r })),
    ...redemptions.filter((r) => r.cardId === card.id).map((r) => ({ type: "redemption" as const, at: r.createdAt, redemption: r })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const submitManual = async () => {
    const motivo = manualReason.trim();
    if (motivo.length < 5) return;
    if (activeLocations.length > 1 && !locationForVisit) return setMsg({ ok: false, text: "Elige la sede donde está el cliente." });
    setBusy("manual");
    const res = await registerManualVisit(card.id, crypto.randomUUID(), motivo, locationForVisit || undefined);
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: res.message });
    const premio = res.data?.reward ? ` ¡Completó la tarjeta y ganó: ${program.rewardName}!` : "";
    setMsg({ ok: true, text: `Visita sumada a mano. Quedó registrada con el motivo en el historial y la auditoría.${premio}` });
    setManualOpen(false);
    setManualReason("");
  };

  const submitReverse = async () => {
    if (!reversing || reason.trim().length < 5) return;
    const ok = await run("reverse", () => reverseVisit(reversing, reason.trim()), "Visita revertida. Quedó registrada en el historial y la auditoría.");
    if (ok) {
      setReversing(null);
      setReason("");
    }
  };

  return (
    <>
      <Link href={`/business/${business.slug}/customers`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={customer.fullName} className="size-12 text-sm" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{customer.fullName}</h1>
            <Badge tone={CARD_STATUS[card.status].tone} dot>
              {CARD_STATUS[card.status].label}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {anonymized && (
              <span className="flex items-center gap-1.5"><UserX className="size-3.5" /> Datos personales eliminados el {formatDate(customer.anonymizedAt)}</span>
            )}
            {customer.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" /> {customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1.5"><Mail className="size-3.5" /> {customer.email}</span>}
            {customer.birthMonth && (
              <span className="flex items-center gap-1.5">
                <Cake className="size-3.5" /> {customer.birthDay} de {MONTHS[customer.birthMonth - 1]}
              </span>
            )}
          </div>
        </div>
        {!anonymized && <div className="flex flex-wrap gap-2">
          {canAddVisit && (
            <Button variant="brand" onClick={() => setManualOpen((v) => !v)}>
              <Plus className="size-4" /> Sumar visita
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(cardUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="size-4" /> {copied ? "Copiado" : "Copiar enlace"}
          </Button>
          {customer.phone && (
            <a href={whatsapp} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <MessageCircle className="size-4" /> {needsInvite ? "Invitar a guardarla" : "Enviar por WhatsApp"}
            </a>
          )}
          <ButtonLink href={`/card/${card.publicToken}`} target="_blank" variant="secondary">
            <ExternalLink className="size-4" /> Ver tarjeta
          </ButtonLink>
        </div>}
      </div>

      {manualOpen && canAddVisit && (
        <Card className="mb-4 space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold">Sumar visita a mano</p>
            <p className="text-xs text-muted">
              Úsalo solo si el sello no se pudo sumar con el toque. Se aplican las mismas reglas de siempre y queda registrado con tu nombre y el motivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_MANUAL.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setManualReason(m)}
                className={cn("rounded-full border px-2.5 py-1 text-xs", manualReason === m ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-line-strong")}
              >
                {m}
              </button>
            ))}
          </div>
          <Input value={manualReason} onChange={(e) => setManualReason(e.target.value)} maxLength={200} placeholder="Motivo (obligatorio)" aria-label="Motivo de la visita a mano" />
          {activeLocations.length > 1 && (
            <Select value={manualLocation} onChange={(e) => setManualLocation(e.target.value)} aria-label="Sede">
              <option value="">Elige la sede donde está el cliente</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex gap-2">
            <Button variant="brand" onClick={submitManual} disabled={manualReason.trim().length < 5 || busy === "manual"}>
              {busy === "manual" ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />} Sumar 1 visita
            </Button>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {msg && (
        <div className={cn("mb-4 rounded-lg border px-4 py-3 text-sm", msg.ok ? "border-success/20 bg-success-bg text-success" : "border-danger/20 bg-danger-bg text-danger")}>{msg.text}</div>
      )}

      {available.length > 0 && (
        <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Gift className="size-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold">
              {available.length === 1 ? `Recompensa disponible: ${available[0].name}` : `${available.length} recompensas disponibles`}
            </p>
            <p className="text-muted">{available[0].expiresAt ? `Vence el ${formatDate(available[0].expiresAt)}` : "Sin vencimiento"}</p>
          </div>
          {canRedeem ? (
            <Button
              variant="brand"
              disabled={busy === "redeem"}
              onClick={() => run("redeem", () => redeemReward(available[0].id), `Canje registrado: ${available[0].name}.`)}
            >
              {busy === "redeem" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Canjear ahora
            </Button>
          ) : (
            <span className="text-xs text-muted">Tu usuario no tiene permiso de canje.</span>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Sellos actuales", `${progress.stamps}/${progress.required}`],
              ["Visitas totales", card.totalVisits],
              ["Recompensas", rewards.filter((r) => r.cardId === card.id).length],
            ].map(([l, v]) => (
              <Card key={l as string} className="p-4">
                <p className="text-xs text-muted">{l}</p>
                <p className="tabular mt-1 text-xl font-semibold">{v}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Historial de movimientos" description="Las visitas no se eliminan: las correcciones se registran como reversiones auditadas." />
            <ul className="divide-y divide-line">
              {timeline.map((t, i) => {
                const reverted = t.type === "visit" && reversedIds.has(t.visit!.id);
                return (
                  <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <div
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        t.type === "visit" && "bg-black/[0.05] text-ink-2",
                        t.type === "reversal" && "bg-warning-bg text-warning",
                        t.type === "reward" && "bg-brand-soft text-brand",
                        t.type === "redemption" && "bg-success-bg text-success",
                      )}
                    >
                      {t.type === "visit" ? <Stamp className="size-3.5" /> : t.type === "reversal" ? <Undo2 className="size-3.5" /> : t.type === "reward" ? <Gift className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className={cn("font-medium", reverted && "text-muted line-through")}>
                        {t.type === "visit" &&
                          `Visita registrada (+${1 + (t.visit!.bonusStamps ?? 0)})${t.visit!.bonusStamps ? " · promoción" : ""}${t.visit!.source === "manual" ? " · a mano" : t.visit!.source === "nfc" ? " · por NFC" : ""}`}
                        {t.type === "reversal" && "Visita revertida (−1)"}
                        {t.type === "reward" && (t.reward!.kind === "birthday" ? `🎂 Regalo de cumpleaños: ${t.reward!.name}` : `Recompensa obtenida: ${t.reward!.name}`)}
                        {t.type === "redemption" && "Recompensa canjeada"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(t.at)}
                        {t.type === "visit" || t.type === "reversal" ? ` · ${staffName(t.visit!.staffId)}` : ""}
                        {t.type === "redemption" ? ` · ${staffName(t.redemption!.staffId)}` : ""}
                      </p>
                      {t.type === "reversal" && t.visit!.reason && <p className="mt-1 text-xs text-ink-2">Motivo: {t.visit!.reason}</p>}

                      {"visit" in t && reversing === t.visit.id && (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la corrección (obligatorio)" className="h-9" />
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" onClick={submitReverse} disabled={reason.trim().length < 5 || busy === "reverse"}>
                              {busy === "reverse" && <Loader2 className="size-3.5 animate-spin" />} Revertir
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setReversing(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    {t.type === "visit" && canReverse && !reverted && reversing !== t.visit!.id && (
                      <button onClick={() => setReversing(t.visit!.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-black/[0.04] hover:text-ink">
                        <RotateCcw className="size-3" /> Revertir
                      </button>
                    )}
                    {reverted && <Badge tone="warning">Revertida</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <LoyaltyCardView
            compact
            business={business}
            program={program}
            customerName={customer.fullName}
            stamps={progress.stamps}
            status={card.status}
            rewardsAvailable={progress.rewardsAvailable}
            memberSince={anonymized ? undefined : formatDate(card.createdAt)}
          />
          <Card className="p-5 text-sm">
            <p className="mb-3 font-semibold">Consentimientos</p>
            <dl className="space-y-2">
              {!anonymized && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Billetera del celular</dt>
                  <dd className="text-right">
                    <WalletBadge fallo={!wallet.loading && !wallet.ok} wallets={wallets} />
                  </dd>
                </div>
              )}
              {needsInvite && !anonymized && (
                <p className="rounded-md bg-canvas px-3 py-2 text-xs text-muted">
                  Sin la tarjeta en la billetera no le llegan los avisos de sellos, premios ni de cercanía. Usa «Invitar a guardarla» para mandarle el enlace por WhatsApp.
                </p>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Términos y tratamiento de datos</dt>
                <dd className="text-right">{formatDate(customer.termsAcceptedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Marketing</dt>
                <dd className="text-right">{customer.marketingConsent ? `Sí · ${formatDate(customer.marketingConsentAt)}` : "No"}</dd>
              </div>
              {customer.marketingConsent && canManageConsent && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === "consent"}
                    onClick={() =>
                      run("consent", () => revokeMarketingConsent(customer.id), "Consentimiento retirado: ya no recibirá Notificaciones. Quedó en la auditoría.")
                    }
                  >
                    {busy === "consent" ? <Loader2 className="size-3.5 animate-spin" /> : <BellOff className="size-3.5" />} Retirar consentimiento
                  </Button>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Token público</dt>
                <dd className="truncate font-mono text-xs">{card.publicToken.slice(0, 6)}…</dd>
              </div>
            </dl>
          </Card>
          {canBlock && (
            <Card className="p-5 text-sm">
              <p className="font-semibold">{card.status === "blocked" ? "Tarjeta bloqueada" : "Bloquear tarjeta"}</p>
              <p className="mt-1 text-muted">
                {card.status === "blocked"
                  ? "No acepta visitas ni canjes, y el cliente ve su tarjeta como bloqueada. El historial se conserva."
                  : "Úsalo si detectas un uso indebido. No borra visitas ni recompensas y se puede deshacer."}
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant={card.status === "blocked" ? "secondary" : "danger"}
                disabled={busy === "block"}
                onClick={() =>
                  run(
                    "block",
                    () => setCardBlocked(card.id, card.status !== "blocked"),
                    card.status === "blocked" ? "Tarjeta reactivada." : "Tarjeta bloqueada. Quedó en la auditoría.",
                  )
                }
              >
                {busy === "block" ? <Loader2 className="size-3.5 animate-spin" /> : card.status === "blocked" ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
                {card.status === "blocked" ? "Reactivar tarjeta" : "Bloquear tarjeta"}
              </Button>
            </Card>
          )}
          {isOwner && !anonymized && (
            <Card className="border-danger/20 p-5 text-sm">
              <p className="font-semibold">Eliminar datos del cliente</p>
              <p className="mt-1 text-muted">
                Para atender una solicitud de supresión (Ley 1581). Se borran su nombre, celular, correo y cumpleaños, y su tarjeta deja de
                funcionar. Las visitas quedan en tus estadísticas sin datos personales. No se puede deshacer.
              </p>
              <label className="mt-3 block text-xs text-muted">
                Escribe <span className="font-semibold text-ink">ELIMINAR</span> para confirmar
                <Input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="mt-1 h-9" />
              </label>
              <Button
                className="mt-3"
                size="sm"
                variant="danger"
                disabled={confirmDelete.trim().toUpperCase() !== "ELIMINAR" || busy === "anonymize"}
                onClick={async () => {
                  const ok = await run("anonymize", () => anonymizeCustomer(customer.id), "Datos eliminados. La acción quedó en la auditoría.");
                  if (ok) setConfirmDelete("");
                }}
              >
                {busy === "anonymize" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Eliminar datos
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
