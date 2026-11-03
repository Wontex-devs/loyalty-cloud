"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Send, Wallet } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { useDemo } from "@/lib/demo/store";
import { WALLET_NOTICE_LABELS, walletSettings } from "@/lib/wallet/messages";
import type { WalletSettings } from "@/lib/domain/types";
import { Badge, Button, Card, CardHeader, Field, Input, Switch, Textarea } from "@/components/ui";
import { formatRelative } from "@/lib/utils";

/** Aviso a la billetera para todo el grupo elegido, con un botón. */
export function WalletCampaignCard({
  segmentKey,
  segmentLabel,
  customerIds,
  defaultTitle,
  defaultBody,
}: {
  segmentKey: string;
  segmentLabel: string;
  customerIds: string[];
  defaultTitle: string;
  defaultBody: string;
}) {
  const { business } = useScope();
  const { sendWalletCampaign } = useDemo();
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Al cambiar de grupo se propone su texto.
  useEffect(() => {
    setTitle(defaultTitle);
    setBody(defaultBody);
    setResult(null);
  }, [segmentKey, defaultTitle, defaultBody]);

  const n = customerIds.length;
  const send = async () => {
    setBusy(true);
    setResult(null);
    const res = await sendWalletCampaign(business.id, customerIds, title, body);
    setBusy(false);
    if (!res.ok) return setResult({ ok: false, text: res.message });
    const parts = [res.sent ? `Aviso enviado a ${res.sent} ${res.sent === 1 ? "cliente" : "clientes"}.` : "No se envió ningún aviso."];
    if (res.notSaved) parts.push(`${res.notSaved} no tienen la tarjeta en su billetera: a ellos escríbeles por WhatsApp.`);
    if (res.skipped) parts.push(`${res.skipped} ya recibieron una campaña esta semana y no se les envió.`);
    if (res.failed) parts.push(`${res.failed} no se pudieron enviar; inténtalo más tarde.`);
    setResult({ ok: true, text: parts.join(" ") });
  };

  return (
    <Card className="h-fit p-5">
      <div className="flex items-center gap-2">
        <Wallet className="size-4" />
        <p className="text-sm font-semibold">Aviso a la billetera</p>
      </div>
      <p className="mt-1 text-xs text-muted">
        Le llega al celular a todo el grupo «{segmentLabel}» de una vez. Máximo una campaña por cliente a la semana.
      </p>
      <Field label="Título" className="mt-3" hint={`${title.trim().length}/40`}>
        <Input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Mensaje" className="mt-3" hint={`${body.trim().length}/240 · {nombre} se cambia por el nombre del cliente`}>
        <Textarea value={body} maxLength={240} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Button className="mt-3 w-full" disabled={busy || n === 0 || !title.trim() || !body.trim()} onClick={send}>
        <Send className="size-4" />
        {busy ? "Enviando…" : n === 0 ? "Nadie en este grupo" : `Enviar a ${n} ${n === 1 ? "cliente" : "clientes"}`}
      </Button>
      {result && <p className={result.ok ? "mt-2 text-xs text-success" : "mt-2 text-xs text-danger"}>{result.text}</p>}
    </Card>
  );
}

const AUTO: { key: keyof Omit<WalletSettings, "winbackDays">; label: string; hint: string }[] = [
  { key: "stamp", label: "Sello nuevo", hint: "Al registrar cada visita: «Vas 6 de 8»." },
  { key: "near", label: "Te falta 1", hint: "Cuando queda un sello para el premio." },
  { key: "reward", label: "Premio listo", hint: "Al completar la tarjeta o recibir el regalo de cumpleaños." },
  { key: "birthday", label: "Cumpleaños", hint: "El día de su cumpleaños. Solo a quien aceptó mensajes." },
  { key: "winback", label: "Te extrañamos", hint: "Cuando lleva varios días sin venir. Solo a quien aceptó mensajes." },
];

/** Avisos automáticos: el comercio decide cuáles envía. */
export function WalletSettingsCard() {
  const { business } = useScope();
  const { updateWalletSettings } = useDemo();
  const [draft, setDraft] = useState<WalletSettings>(() => walletSettings(business.walletNotifications));
  const [days, setDays] = useState(String(draft.winbackDays));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: WalletSettings) => {
    setDraft(next);
    setBusy(true);
    const res = await updateWalletSettings(business.id, next);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Guardado." } : { ok: false, text: res.message });
  };

  return (
    <Card>
      <CardHeader
        title="Avisos automáticos"
        description="Llegan solos al celular de quien tiene la tarjeta en su billetera."
        action={msg ? <span className={msg.ok ? "text-xs text-success" : "text-xs text-danger"}>{msg.text}</span> : undefined}
      />
      <ul className="divide-y divide-line">
        {AUTO.map((a) => (
          <li key={a.key} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted">{a.hint}</p>
            </div>
            <Switch label={a.label} checked={draft[a.key]} onChange={(v) => !busy && save({ ...draft, [a.key]: v })} />
          </li>
        ))}
        <li className="flex items-center gap-3 px-5 py-3">
          <p className="flex-1 text-sm">Días sin venir para «Te extrañamos»</p>
          <Input
            type="number"
            min={14}
            max={180}
            className="w-20"
            value={days}
            disabled={!draft.winback}
            onChange={(e) => setDays(e.target.value)}
            onBlur={() => {
              const n = Number(days);
              if (n !== draft.winbackDays) void save({ ...draft, winbackDays: n });
            }}
          />
        </li>
      </ul>
    </Card>
  );
}

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "danger" | "warning" }> = {
  sent: { label: "Enviado", tone: "success" },
  not_saved: { label: "Sin billetera", tone: "neutral" },
  failed: { label: "Falló", tone: "danger" },
  pending: { label: "Pendiente", tone: "warning" },
};

/** Últimos avisos enviados, para saber qué le llegó a quién. */
export function RecentWalletNotices() {
  const { walletNotices, cards, customers } = useScope();
  const nameOf = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    return customers.find((c) => c.id === card?.customerId)?.fullName ?? "Cliente";
  };
  const list = walletNotices.slice(0, 12);

  return (
    <Card>
      <CardHeader title="Últimos avisos" description={`${walletNotices.filter((n) => n.status === "sent").length} enviados en total`} />
      {list.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
          <BellRing className="size-4" /> Aún no se ha enviado ningún aviso.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{n.title}</p>
                <p className="truncate text-xs text-muted">
                  {WALLET_NOTICE_LABELS[n.kind]} · {nameOf(n.cardId)} · {formatRelative(n.createdAt)}
                </p>
              </div>
              <Badge tone={STATUS[n.status]?.tone ?? "neutral"}>{STATUS[n.status]?.label ?? n.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
