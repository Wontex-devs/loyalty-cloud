"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import { activePromotion, localDay } from "@/lib/domain/promotions";
import { isRewardUsable } from "@/lib/domain/stats";
import { publicOrigin } from "@/lib/config";
import { Avatar, Card, EmptyState, PageHeader, Segmented, Textarea } from "@/components/ui";
import { RecentWalletNotices, WalletCampaignCard, WalletSettingsCard } from "@/components/business/wallet-notices";
import { greetingName } from "@/lib/wallet/messages";
import { formatRelative } from "@/lib/utils";

type Segment = "near" | "reward" | "inactive" | "birthday" | "new" | "all";

const SEGMENTS: { value: Segment; label: string; hint: string; template: string; wallet: { title: string; body: string } }[] = [
  {
    value: "near",
    label: "Cerca del premio",
    hint: "Les faltan 1 o 2 visitas para la recompensa.",
    template: "Hola {nombre} 💅 ¡Solo te {faltan} para tu {recompensa} en {negocio}! Te esperamos. Tu tarjeta: {enlace}",
    wallet: { title: "¡Ya casi tienes tu premio!", body: "Hola {nombre}, estás a muy poco de tu premio. ¡Te esperamos!" },
  },
  {
    value: "reward",
    label: "Premio sin canjear",
    hint: "Tienen una recompensa disponible.",
    template: "Hola {nombre}, tienes un regalo esperándote en {negocio}: {recompensa}. Muéstrale tu tarjeta al equipo en tu próxima visita: {enlace}",
    wallet: { title: "Tienes un premio esperándote", body: "Hola {nombre}, tu premio está listo. Muestra tu tarjeta en tu próxima visita." },
  },
  {
    value: "inactive",
    label: "Hace tiempo no vienen",
    hint: "Su última visita fue hace más de 45 días.",
    template: "Hola {nombre}, ¡te extrañamos en {negocio}! Llevas {sellos} sellos en tu tarjeta. Agenda tu próxima cita y sigue sumando: {enlace}",
    wallet: { title: "Te extrañamos", body: "Hola {nombre}, hace rato no te vemos. ¡Vuelve y sigue sumando sellos!" },
  },
  {
    value: "birthday",
    label: "Cumpleaños del mes",
    hint: "Cumplen años este mes.",
    template: "¡Feliz cumpleaños, {nombre}! 🎂 En {negocio} queremos celebrarlo contigo. Ven este mes y te espera una sorpresa. Tu tarjeta: {enlace}",
    wallet: { title: "¡Feliz mes de cumpleaños!", body: "Hola {nombre}, este mes queremos celebrarlo contigo. ¡Te esperamos!" },
  },
  {
    value: "new",
    label: "Nuevas",
    hint: "Se inscribieron en los últimos 30 días y aún no repiten.",
    template: "Hola {nombre}, gracias por unirte a {negocio}. En tu próxima visita sumas otro sello. Tu tarjeta: {enlace}",
    wallet: { title: "Gracias por unirte", body: "Hola {nombre}, en tu próxima visita sumas otro sello. ¡Te esperamos!" },
  },
  {
    value: "all",
    label: "Todas",
    hint: "Todas las clientes que aceptaron recibir mensajes.",
    template: "Hola {nombre}, tenemos novedades en {negocio}. Tu tarjeta: {enlace}",
    wallet: { title: "Novedades para ti", body: "Hola {nombre}, tenemos novedades. ¡Te esperamos!" },
  },
];

const DAY = 86400000;

export default function CampaignsPage() {
  const { business, program, membership, customers, cards, rewards, contacts, promotions } = useScope();
  const { logContact } = useData();
  const required = program?.stampsRequired ?? 1;
  const month = localDay(new Date(), business.timezone).month;
  const promo = activePromotion(promotions, new Date(), business.timezone);

  // ¿Pertenece esta clienta al grupo? (una sola regla para el listado y para los contadores)
  const enGrupo = useCallback(
    (seg: Segment, customer: (typeof customers)[number], c: (typeof cards)[number], now: number) => {
      const left = required - c.currentStamps;
      switch (seg) {
        case "near":
          return c.currentStamps > 0 && left <= 2;
        case "reward":
          return rewards.some((r) => r.cardId === c.id && isRewardUsable(r));
        case "inactive":
          return !!c.lastVisitAt && now - new Date(c.lastVisitAt).getTime() > 45 * DAY;
        case "birthday":
          return customer.birthMonth === month;
        case "new":
          return now - new Date(customer.createdAt).getTime() < 30 * DAY && c.totalVisits <= 1;
        default:
          return true;
      }
    },
    [required, rewards, month],
  );

  // Cuántas personas que aceptaron mensajes hay en cada grupo: se muestra en las pestañas.
  const conteo = useMemo(() => {
    const now = Date.now();
    const cardOf = new Map(cards.map((c) => [c.customerId, c]));
    const base = customers.filter((cu) => cu.marketingConsent && cardOf.get(cu.id) && cardOf.get(cu.id)!.status !== "blocked");
    return Object.fromEntries(
      SEGMENTS.map((s) => [s.value, base.filter((cu) => enGrupo(s.value, cu, cardOf.get(cu.id)!, now)).length]),
    ) as Record<Segment, number>;
  }, [customers, cards, enGrupo]);

  // Se abre en el primer grupo que tiene a alguien; si todos están vacíos, en «Todas».
  const [segment, setSegment] = useState<Segment>(() => SEGMENTS.find((s) => s.value !== "all" && conteo[s.value] > 0)?.value ?? "all");
  const [templates, setTemplates] = useState<Record<Segment, string>>(
    () => Object.fromEntries(SEGMENTS.map((s) => [s.value, s.template])) as Record<Segment, string>,
  );
  const [sent, setSent] = useState<Set<string>>(new Set());

  const lastContact = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts) if (!m.has(c.customerId) || m.get(c.customerId)! < c.createdAt) m.set(c.customerId, c.createdAt);
    return m;
  }, [contacts]);

  const rows = useMemo(() => {
    const now = Date.now();
    const cardOf = new Map(cards.map((c) => [c.customerId, c]));
    return customers
      .map((customer) => ({ customer, card: cardOf.get(customer.id) }))
      .filter(({ card }) => card && card.status !== "blocked")
      .filter(({ customer, card }) => enGrupo(segment, customer, card!, now));
  }, [customers, cards, segment, enGrupo]);

  const allowed = rows.filter(({ customer }) => customer.marketingConsent);
  const withoutConsent = rows.length - allowed.length;
  const current = SEGMENTS.find((s) => s.value === segment)!;

  const message = (customerId: string) => {
    const { customer, card } = rows.find((r) => r.customer.id === customerId)!;
    const reward = rewards.find((r) => r.cardId === card!.id && isRewardUsable(r))?.name ?? program?.rewardName ?? "";
    const left = Math.max(required - card!.currentStamps, 1);
    let text = templates[segment]
      .replaceAll("{nombre}", greetingName(customer))
      .replaceAll("{negocio}", business.name)
      .replaceAll("{recompensa}", reward)
      .replaceAll("{sellos}", String(card!.currentStamps))
      .replaceAll("{faltan}", left === 1 ? "falta 1 visita" : `faltan ${left} visitas`)
      .replaceAll("{enlace}", `${publicOrigin()}/card/${card!.publicToken}`);
    if (promo) text += `\nHoy tenemos ${promo.name}: cada visita suma ${1 + promo.bonusStamps} sellos.`;
    return `https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  };

  return (
    <RequirePermission allowed={!!membership && can(membership, "program.edit")}>
      <PageHeader
        title="Notificaciones"
        description="Elige un grupo, escribe el mensaje y envíalo: llega como notificación al celular de tus clientes y queda guardado en su tarjeta."
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>Solo les llega a quienes aceptaron recibir mensajes, y como máximo una notificación por semana a cada cliente.</p>
      </div>

      <p className="mb-2 text-sm font-medium">1. Elige a quién le llega</p>
      <div className="mb-4 overflow-x-auto">
        <Segmented<Segment>
          value={segment}
          onChange={setSegment}
          options={SEGMENTS.map(({ value, label }) => ({ value, label: `${label} · ${conteo[value]}` }))}
        />
      </div>
      <p className="mb-2 text-sm font-medium">2. Escribe y envía</p>

      {/* Lo principal (la notificación a la billetera) va primero; WhatsApp queda como opción aparte. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <WalletCampaignCard
            segmentKey={segment}
            segmentLabel={current.label}
            customerIds={allowed.map(({ customer }) => customer.id)}
            defaultTitle={current.wallet.title}
            defaultBody={current.wallet.body}
          />
          <Card>
            <div className="border-b border-line px-5 py-3 text-sm">
              <p className="font-medium">
                Quiénes lo reciben: {allowed.length} {allowed.length === 1 ? "cliente" : "clientes"} · {current.hint}
              </p>
              {withoutConsent > 0 && <p className="text-xs text-muted">{withoutConsent} más en este grupo no aceptaron mensajes y no aparecen.</p>}
            </div>
            {allowed.length === 0 ? (
              <EmptyState icon={Users} title="Nadie en este grupo por ahora" />
            ) : (
              <ul className="divide-y divide-line">
                {allowed.map(({ customer, card }) => {
                  const last = lastContact.get(customer.id);
                  const done = sent.has(customer.id);
                  return (
                    <li key={customer.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <Avatar name={customer.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{customer.fullName}</p>
                        <p className="text-xs text-muted">
                          {card!.currentStamps}/{required} sellos
                          {last ? ` · último mensaje ${formatRelative(last)}` : " · sin mensajes todavía"}
                        </p>
                      </div>
                      <a
                        href={message(customer.id)}
                        target="_blank"
                        rel="noopener"
                        onClick={() => {
                          setSent((s) => new Set(s).add(customer.id));
                          void logContact(customer.id, segment);
                        }}
                        title="Escribirle por WhatsApp (opcional)"
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-muted hover:border-line-strong hover:text-ink"
                      >
                        {done ? <Check className="size-3.5" /> : <MessageCircle className="size-3.5 text-[#25D366]" />} {done ? "Escrito" : "WhatsApp"}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <details className="group h-fit rounded-2xl border border-line bg-surface p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold">
            <span className="flex items-center gap-2">
              <MessageCircle className="size-4 text-[#25D366]" /> Escribir por WhatsApp (opcional)
              <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Ver</span>
            </span>
          </summary>
          <p className="mt-2 text-xs text-muted">
            Para escribirle a alguien en particular desde tu WhatsApp, con el botón «WhatsApp» de cada cliente. Este es el texto que se abre:
          </p>
          <p className="mt-1 text-xs text-muted">
            Variables: {"{nombre}"} {"{negocio}"} {"{recompensa}"} {"{sellos}"} {"{faltan}"} {"{enlace}"}
          </p>
          <Textarea
            className="mt-3 min-h-40"
            value={templates[segment]}
            onChange={(e) => setTemplates((t) => ({ ...t, [segment]: e.target.value }))}
          />
          {promo && <p className="mt-2 text-xs text-muted">Se añadirá al final: la promoción de hoy ({promo.name}).</p>}
        </details>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <WalletSettingsCard />
        <RecentWalletNotices />
      </div>
    </RequirePermission>
  );
}
