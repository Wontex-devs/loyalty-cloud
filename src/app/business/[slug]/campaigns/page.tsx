"use client";

import { useMemo, useState } from "react";
import { Check, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { useDemo } from "@/lib/demo/store";
import { can } from "@/lib/domain/permissions";
import { activePromotion, localDay } from "@/lib/domain/promotions";
import { isRewardUsable } from "@/lib/domain/stats";
import { publicOrigin } from "@/lib/config";
import { Avatar, Card, EmptyState, PageHeader, Segmented, Textarea } from "@/components/ui";
import { formatRelative } from "@/lib/utils";

type Segment = "near" | "reward" | "inactive" | "birthday" | "new" | "all";

const SEGMENTS: { value: Segment; label: string; hint: string; template: string }[] = [
  {
    value: "near",
    label: "Cerca del premio",
    hint: "Les faltan 1 o 2 visitas para la recompensa.",
    template: "Hola {nombre} 💅 ¡Solo te {faltan} para tu {recompensa} en {negocio}! Te esperamos. Tu tarjeta: {enlace}",
  },
  {
    value: "reward",
    label: "Premio sin canjear",
    hint: "Tienen una recompensa disponible.",
    template: "Hola {nombre}, tienes un regalo esperándote en {negocio}: {recompensa}. Muéstrale tu tarjeta al equipo en tu próxima visita: {enlace}",
  },
  {
    value: "inactive",
    label: "Hace tiempo no vienen",
    hint: "Su última visita fue hace más de 45 días.",
    template: "Hola {nombre}, ¡te extrañamos en {negocio}! Llevas {sellos} sellos en tu tarjeta. Agenda tu próxima cita y sigue sumando: {enlace}",
  },
  {
    value: "birthday",
    label: "Cumpleaños del mes",
    hint: "Cumplen años este mes.",
    template: "¡Feliz cumpleaños, {nombre}! 🎂 En {negocio} queremos celebrarlo contigo. Ven este mes y te espera una sorpresa. Tu tarjeta: {enlace}",
  },
  {
    value: "new",
    label: "Nuevas",
    hint: "Se inscribieron en los últimos 30 días y aún no repiten.",
    template: "Hola {nombre}, gracias por unirte a {negocio}. En tu próxima visita sumas otro sello. Tu tarjeta: {enlace}",
  },
  {
    value: "all",
    label: "Todas",
    hint: "Todas las clientas que aceptaron recibir mensajes.",
    template: "Hola {nombre}, tenemos novedades en {negocio}. Tu tarjeta: {enlace}",
  },
];

const DAY = 86400000;

export default function CampaignsPage() {
  const { business, program, membership, customers, cards, rewards, contacts, promotions } = useScope();
  const { logContact } = useDemo();
  const [segment, setSegment] = useState<Segment>("near");
  const [templates, setTemplates] = useState<Record<Segment, string>>(
    () => Object.fromEntries(SEGMENTS.map((s) => [s.value, s.template])) as Record<Segment, string>,
  );
  const [sent, setSent] = useState<Set<string>>(new Set());
  const required = program?.stampsRequired ?? 1;
  const month = localDay(new Date(), business.timezone).month;
  const promo = activePromotion(promotions, new Date(), business.timezone);

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
      .filter(({ customer, card }) => {
        const c = card!;
        const left = required - c.currentStamps;
        switch (segment) {
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
      });
  }, [customers, cards, rewards, segment, required, month]);

  const allowed = rows.filter(({ customer }) => customer.marketingConsent);
  const withoutConsent = rows.length - allowed.length;
  const current = SEGMENTS.find((s) => s.value === segment)!;

  const message = (customerId: string) => {
    const { customer, card } = rows.find((r) => r.customer.id === customerId)!;
    const reward = rewards.find((r) => r.cardId === card!.id && isRewardUsable(r))?.name ?? program?.rewardName ?? "";
    const left = Math.max(required - card!.currentStamps, 1);
    let text = templates[segment]
      .replaceAll("{nombre}", customer.fullName.trim().split(/\s+/)[0])
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
        title="Campañas"
        description="Escríbeles por WhatsApp a tus clientas, una por una y desde tu propio teléfono. Solo aparecen las que aceptaron recibir mensajes."
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          No hay envíos masivos ni automáticos: cada mensaje lo abres y lo envías tú. Cada envío queda registrado, para que no le escribas a la misma clienta dos veces seguidas.
        </p>
      </div>

      <div className="mb-4 overflow-x-auto">
        <Segmented<Segment> value={segment} onChange={setSegment} options={SEGMENTS.map(({ value, label }) => ({ value, label }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <div className="border-b border-line px-5 py-3 text-sm">
            <p className="font-medium">
              {allowed.length} {allowed.length === 1 ? "clienta" : "clientas"} · {current.hint}
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
                      className={
                        done
                          ? "flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-muted"
                          : "flex h-8 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[13px] font-medium text-white"
                      }
                    >
                      {done ? <Check className="size-3.5" /> : <MessageCircle className="size-3.5" />} {done ? "Enviado" : "WhatsApp"}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="h-fit p-5">
          <p className="text-sm font-semibold">Mensaje</p>
          <p className="mt-1 text-xs text-muted">
            Variables: {"{nombre}"} {"{negocio}"} {"{recompensa}"} {"{sellos}"} {"{faltan}"} {"{enlace}"}
          </p>
          <Textarea
            className="mt-3 min-h-40"
            value={templates[segment]}
            onChange={(e) => setTemplates((t) => ({ ...t, [segment]: e.target.value }))}
          />
          {promo && <p className="mt-2 text-xs text-muted">Se añadirá al final: la promoción de hoy ({promo.name}).</p>}
        </Card>
      </div>
    </RequirePermission>
  );
}
