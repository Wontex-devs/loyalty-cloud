"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, HeartHandshake, MapPin, Send, Wallet } from "lucide-react";
import { useScope } from "@/components/business/business-shell";
import { useData } from "@/lib/data/store";
import {
  DEFAULT_WALLET_SETTINGS,
  NEARBY_TEXT_MAX,
  NEARBY_TEXT_MIN,
  WALLET_NOTICE_LABELS,
  WINBACK_TEXT_DEFAULT,
  WINBACK_TEXT_MAX,
  WINBACK_TEXT_MIN,
  dailyNotice,
  nearbyMessage,
  walletSettings,
} from "@/lib/wallet/messages";
import type { WalletSettings } from "@/lib/domain/types";
import { Badge, Button, Card, CardHeader, Field, Input, Switch, Textarea } from "@/components/ui";
import { formatRelative } from "@/lib/utils";
import { NumberInput } from "@/components/ui/number-input";

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
  const { sendWalletCampaign } = useData();
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
    if (res.skipped) parts.push(`${res.skipped} ya recibieron una notificación esta semana y no se les envió.`);
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
        Le llega al celular a todo el grupo «{segmentLabel}» de una vez. Máximo una notificación por cliente a la semana.
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

const AUTO: { key: "stamp" | "near" | "reward" | "birthday" | "winback" | "almost"; label: string; hint: string }[] = [
  { key: "stamp", label: "Sello nuevo", hint: "Al registrar cada visita: «Vas 6 de 8»." },
  { key: "near", label: "Te falta 1", hint: "Cuando queda un sello para el premio." },
  { key: "reward", label: "Premio listo", hint: "Al completar la tarjeta o recibir el regalo de cumpleaños." },
  { key: "birthday", label: "Cumpleaños", hint: "El día de su cumpleaños. Solo a quien aceptó mensajes." },
  { key: "almost", label: "Te falta poco", hint: "Recordatorio a quien está a 1 o 2 sellos del premio y lleva unos días sin venir. Solo a quien aceptó mensajes." },
  { key: "winback", label: "Te extrañamos", hint: "Cuando lleva varios días sin venir. Solo a quien aceptó mensajes." },
];

/** Avisos automáticos: el comercio decide cuáles envía. */
export function WalletSettingsCard() {
  const { business } = useScope();
  const { updateWalletSettings } = useData();
  const [draft, setDraft] = useState<WalletSettings>(() => walletSettings(business.walletNotifications));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: WalletSettings) => {
    setMsg(null);
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
          <p className="flex-1 text-sm">Días sin venir para «Te falta poco» <span className="text-xs text-muted">(de 5 a 60)</span></p>
          <NumberInput
            min={5}
            max={60}
            soloAlSalir
            className="w-20"
            aria-label="Días sin venir para «Te falta poco» (de 5 a 60)"
            value={draft.almostDays}
            disabled={!draft.almost}
            onValueChange={(n) => void save({ ...draft, almostDays: n })}
          />
        </li>
        <li className="flex items-center gap-3 px-5 py-3">
          <p className="flex-1 text-sm">Días sin venir para «Te extrañamos» <span className="text-xs text-muted">(de 14 a 180)</span></p>
          <NumberInput
            min={14}
            max={180}
            soloAlSalir
            className="w-20"
            aria-label="Días sin venir para «Te extrañamos» (de 14 a 180)"
            value={draft.winbackDays}
            disabled={!draft.winback}
            onValueChange={(n) => void save({ ...draft, winbackDays: n })}
          />
        </li>
        <WinbackMessage value={draft.winbackText} disabled={!draft.winback} busy={busy} onSave={(winbackText) => save({ ...draft, winbackText })} />
        <NearbyMessage value={draft.nearbyText} busy={busy} onSave={(nearbyText) => save({ ...draft, nearbyText })} />
      </ul>
      <ReminderResults />
    </Card>
  );
}

/** Mensaje propio de «Te extrañamos», con vista previa. Vacío = el texto sugerido. */
function WinbackMessage({ value, disabled, busy, onSave }: { value: string; disabled: boolean; busy: boolean; onSave: (text: string) => Promise<void> }) {
  const { business, program } = useScope();
  const actual = value || WINBACK_TEXT_DEFAULT;
  const [text, setText] = useState(actual);
  useEffect(() => setText(value || WINBACK_TEXT_DEFAULT), [value]);
  const len = text.trim().length;
  const valid = len >= WINBACK_TEXT_MIN && len <= WINBACK_TEXT_MAX;
  const changed = text.trim() !== actual;
  const required = program?.stampsRequired ?? 8;
  const preview = dailyNotice("winback", {
    firstName: "María",
    businessName: business.name,
    stamps: Math.max(required - 3, 1),
    required,
    rewardName: program?.rewardName ?? "premio",
    message: valid ? text : actual,
  });
  // Lo que se guarda: vacío si es igual al sugerido (así, si mejora el sugerido, le llega a todos).
  const guardar = () => onSave(text.trim() === WINBACK_TEXT_DEFAULT ? "" : text.trim());

  return (
    <li className={disabled ? "px-5 py-4 opacity-60" : "px-5 py-4"}>
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Mensaje de «Te extrañamos»</p>
          <p className="text-xs text-muted">Escríbelo como le hablarías a tu cliente. Puedes ofrecer algo para que vuelva.</p>
        </div>
      </div>
      <Field label="Mensaje" className="mt-3" hint={`${len}/${WINBACK_TEXT_MAX}`}>
        <Textarea value={text} maxLength={WINBACK_TEXT_MAX} disabled={disabled} className="min-h-20" onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            title={v.hint}
            disabled={disabled}
            className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:bg-black/5 disabled:opacity-50"
            onClick={() => setText((t) => (t.length + v.token.length <= WINBACK_TEXT_MAX ? `${t.trimEnd()} ${v.token}` : t))}
          >
            + {v.token}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-[#1c1c1e] p-3 text-white" aria-label="Vista previa del aviso en el celular">
        <p className="text-[11px] tracking-wide text-white/60 uppercase">{business.name} · Así se verá</p>
        <p className="mt-1 text-sm font-semibold leading-snug">{preview.title}</p>
        <p className="text-sm leading-snug text-white/90">{preview.body}</p>
      </div>
      {!valid && len > 0 && <p className="mt-2 text-xs text-danger">Escribe entre {WINBACK_TEXT_MIN} y {WINBACK_TEXT_MAX} caracteres.</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {text.trim() !== WINBACK_TEXT_DEFAULT && (
          <Button type="button" size="sm" variant="ghost" disabled={busy || disabled} onClick={() => setText(WINBACK_TEXT_DEFAULT)}>
            Usar el texto sugerido
          </Button>
        )}
        <Button type="button" size="sm" disabled={busy || disabled || !valid || !changed} onClick={() => void guardar()}>
          Guardar mensaje
        </Button>
      </div>
    </li>
  );
}

const DIAS_RESULTADOS = 90;

/** ¿Sirven los recordatorios? Cuántos se enviaron y cuántos de esos clientes volvieron después. */
function ReminderResults() {
  const { walletNotices, visits } = useScope();
  const desde = Date.now() - DIAS_RESULTADOS * 86_400_000;
  const enviados = walletNotices.filter(
    (n) => (n.kind === "winback" || n.kind === "almost") && n.status === "sent" && new Date(n.createdAt).getTime() >= desde,
  );
  const volvieron = enviados.filter((n) => {
    const t = new Date(n.createdAt).getTime();
    return visits.some((v) => v.cardId === n.cardId && v.kind === "visit" && new Date(v.createdAt).getTime() > t);
  }).length;

  return (
    <div className="border-t border-line px-5 py-4">
      <p className="text-sm font-medium">Resultados de los recordatorios</p>
      {enviados.length === 0 ? (
        <p className="mt-1 text-xs text-muted">
          Aún no se ha enviado ninguno. Salen solos cada mañana a quien cumpla la condición; aquí verás cuántos clientes volvieron gracias a ellos.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="text-2xl font-semibold">{enviados.length}</p>
            <p className="text-xs text-muted">recordatorios enviados (últimos {DIAS_RESULTADOS} días)</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="text-2xl font-semibold text-success">{volvieron}</p>
            <p className="text-xs text-muted">
              {volvieron === 1 ? "cliente volvió" : "clientes volvieron"} después del aviso ({Math.round((volvieron / enviados.length) * 100)}%)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const VARIABLES = [
  { token: "{nombre}", hint: "nombre del cliente" },
  { token: "{comercio}", hint: "nombre del comercio" },
  { token: "{progreso}", hint: "cuánto le falta o su premio listo" },
];

/** Mensaje que el iPhone muestra en la pantalla bloqueada cerca de una sede con ubicación. */
function NearbyMessage({ value, busy, onSave }: { value: string; busy: boolean; onSave: (text: string) => Promise<void> }) {
  const { business, program, locations } = useScope();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const located = locations.filter((l) => l.active && l.latitude != null).length;
  const len = text.trim().length;
  const valid = len >= NEARBY_TEXT_MIN && len <= NEARBY_TEXT_MAX;
  const changed = text.trim() !== value;
  const left = Math.max((program?.stampsRequired ?? 8) - 2, 1);
  const preview = nearbyMessage(valid ? text : value, {
    nombre: "María",
    comercio: business.name,
    progreso: `Te faltan ${left} visitas para ${program?.rewardName ?? "tu premio"}`,
  });

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Cerca del local</p>
          <p className="text-xs text-muted">
            {located
              ? `Activo en ${located === 1 ? "1 sede" : `${located} sedes`}. En iPhone, la tarjeta aparece en la pantalla bloqueada con este mensaje.`
              : "Sin sedes con ubicación: agrégala en Ajustes → Sedes para activarlo."}
          </p>
        </div>
      </div>
      <Field label="Mensaje (iPhone)" className="mt-3" hint={`${len}/${NEARBY_TEXT_MAX}`}>
        <Textarea value={text} maxLength={NEARBY_TEXT_MAX} className="min-h-20" onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            title={v.hint}
            className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:bg-black/5"
            onClick={() => setText((t) => (t.length + v.token.length <= NEARBY_TEXT_MAX ? `${t.trimEnd()} ${v.token}` : t))}
          >
            + {v.token}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-[#1c1c1e] p-3 text-white" aria-label="Vista previa en la pantalla bloqueada del iPhone">
        <p className="text-[11px] tracking-wide text-white/60 uppercase">{business.name} · Así se verá</p>
        <p className="mt-1 text-sm leading-snug">{preview}</p>
      </div>
      {!valid && len > 0 && <p className="mt-2 text-xs text-danger">Escribe entre {NEARBY_TEXT_MIN} y {NEARBY_TEXT_MAX} caracteres.</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {text.trim() !== DEFAULT_WALLET_SETTINGS.nearbyText && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setText(DEFAULT_WALLET_SETTINGS.nearbyText)}>
            Usar el texto sugerido
          </Button>
        )}
        <Button type="button" size="sm" disabled={busy || !valid || !changed} onClick={() => onSave(text.trim())}>
          Guardar mensaje
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        En Android, Google Wallet muestra su propio aviso de cercanía (con el nombre del comercio); ese texto no se puede cambiar.
      </p>
    </li>
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
