"use client";

import { useState } from "react";
import { AtSign, Clock, Globe, Loader2, MapPin, MessageCircle } from "lucide-react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { updatePassInfoAction } from "@/lib/data/loyalty-actions";
import { HOURS_MAX, prettyPhone } from "@/lib/wallet/pass-info";
import type { Business } from "@/lib/domain/types";

/**
 * Reverso del pase en Wallet: el comercio escribe su WhatsApp, Instagram, sitio web y horario.
 * El cliente los ve al tocar los tres puntos de la tarjeta (iPhone) o como enlaces (Android).
 */
export function PassInfoCard({ business }: { business: Pick<Business, "id" | "passInfo" | "legal"> }) {
  const start = business.passInfo;
  const [form, setForm] = useState({
    whatsapp: start.whatsapp ? prettyPhone(start.whatsapp) : "",
    instagram: start.instagram ? `@${start.instagram}` : "",
    website: start.website?.replace(/^https:\/\//, "") ?? "",
    hours: start.hours ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    const res = await updatePassInfoAction(business.id, form);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.message });
    setForm({
      whatsapp: res.info.whatsapp ? prettyPhone(res.info.whatsapp) : "",
      instagram: res.info.instagram ? `@${res.info.instagram}` : "",
      website: res.info.website?.replace(/^https:\/\//, "") ?? "",
      hours: res.info.hours ?? "",
    });
    setMsg({ ok: true, text: "Guardado. Los pases de tus clientes se actualizan solos en unos segundos." });
  };

  return (
    <Card>
      <CardHeader
        title="Reverso del pase en Wallet"
        description="Lo que tus clientes ven al tocar los tres puntos de su tarjeta en Wallet: para reservar, seguirte y llegar. Todo es opcional; lo que dejes vacío no aparece."
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="WhatsApp para reservar">
          <div className="relative">
            <MessageCircle className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={form.whatsapp} onChange={set("whatsapp")} placeholder="+57 300 123 4567" className="pl-9" inputMode="tel" />
          </div>
        </Field>
        <Field label="Instagram">
          <div className="relative">
            <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={form.instagram} onChange={set("instagram")} placeholder="@tusalon" className="pl-9" />
          </div>
        </Field>
        <Field label="Sitio web">
          <div className="relative">
            <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={form.website} onChange={set("website")} placeholder="www.tusalon.com" className="pl-9" inputMode="url" />
          </div>
        </Field>
        <Field label="Horario">
          <div className="relative">
            <Clock className="pointer-events-none absolute top-3 left-3 size-4 text-subtle" />
            <textarea
              value={form.hours}
              onChange={set("hours")}
              maxLength={HOURS_MAX}
              rows={3}
              placeholder={"Lun a sáb: 9:00 a. m. – 7:00 p. m.\nDom: cerrado"}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pr-3 pl-9 text-sm shadow-card focus:border-cobalt focus:ring-4 focus:ring-cobalt/10 focus:outline-none"
            />
          </div>
        </Field>
        <p className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          {business.legal.address
            ? `«Cómo llegar» usa tu dirección (${business.legal.address}) y la ubicación de tu sede para abrir el mapa.`
            : "Para que aparezca «Cómo llegar», escribe tu dirección en Ajustes o marca la ubicación de tu sede."}
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Guardar reverso
          </Button>
          {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</p>}
        </div>
      </div>
    </Card>
  );
}
