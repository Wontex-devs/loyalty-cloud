"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageUp, Loader2, Printer, Trash2 } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useScope, RequirePermission } from "@/components/business/business-shell";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { BrandMark, FILLED_STAMP_ICONS, STAMP_ICON_COMPONENTS, STAMP_ICON_LABELS } from "@/components/loyalty/brand-mark";
import { useData } from "@/lib/data/store";
import { can } from "@/lib/domain/permissions";
import { PUBLIC_HOST_LABEL } from "@/lib/config";
import { STAMP_ICONS, type BusinessBranding, type CardStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { NfcCard } from "@/components/business/nfc-card";
import { Button, buttonClass, Card, CardHeader, Field, Input, PageHeader, Segmented } from "@/components/ui";

const PRESETS: { name: string; colors: Partial<BusinessBranding> }[] = [
  { name: "Azul Lazo", colors: { cardBackground: "#1b3fd8", cardForeground: "#ffc928", primary: "#1b3fd8", primaryForeground: "#ffc928", accent: "#ffc928" } },
  { name: "Noche", colors: { cardBackground: "#0e1a52", cardForeground: "#ffffff", primary: "#0e1a52", primaryForeground: "#ffffff", accent: "#ffffff" } },
  { name: "Sol", colors: { cardBackground: "#ffc928", cardForeground: "#0e1a52", primary: "#0e1a52", primaryForeground: "#ffc928", accent: "#0e1a52" } },
  { name: "Blanco", colors: { cardBackground: "#ffffff", cardForeground: "#1b3fd8", primary: "#1b3fd8", primaryForeground: "#ffffff", accent: "#1b3fd8" } },
  { name: "Coral", colors: { cardBackground: "#ff7a66", cardForeground: "#0e1a52", primary: "#0e1a52", primaryForeground: "#ff7a66", accent: "#0e1a52" } },
  { name: "Selva", colors: { cardBackground: "#0f5c4a", cardForeground: "#f6efd9", primary: "#0f5c4a", primaryForeground: "#f6efd9", accent: "#f6efd9" } },
  { name: "Vino", colors: { cardBackground: "#6d1f3a", cardForeground: "#ffe8d6", primary: "#6d1f3a", primaryForeground: "#ffe8d6", accent: "#ffe8d6" } },
  { name: "Uva", colors: { cardBackground: "#4b2e83", cardForeground: "#ffffff", primary: "#4b2e83", primaryForeground: "#ffffff", accent: "#ffffff" } },
  { name: "Carbón", colors: { cardBackground: "#141414", cardForeground: "#ffc928", primary: "#141414", primaryForeground: "#ffc928", accent: "#ffc928" } },
  { name: "Arena", colors: { cardBackground: "#f1e6d3", cardForeground: "#2b2b2b", primary: "#2b2b2b", primaryForeground: "#f1e6d3", accent: "#2b2b2b" } },
  { name: "Menta", colors: { cardBackground: "#bfe8d4", cardForeground: "#0f3d2e", primary: "#0f3d2e", primaryForeground: "#bfe8d4", accent: "#0f3d2e" } },
  { name: "Cielo", colors: { cardBackground: "#cfe3ff", cardForeground: "#0e1a52", primary: "#0e1a52", primaryForeground: "#cfe3ff", accent: "#0e1a52" } },
];

const COLOR_FIELDS: { key: keyof BusinessBranding; label: string }[] = [
  { key: "cardBackground", label: "Fondo de la tarjeta" },
  { key: "cardForeground", label: "Texto y sellos" },
  { key: "primary", label: "Color principal (botones)" },
  { key: "accent", label: "Acento" },
];

export default function CardDesignPage() {
  const { business, program, membership } = useScope();
  const { updateBranding, setLogo, setCover } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const changeLogo = async (file: File | null) => {
    setLogoBusy(true);
    setLogoError(null);
    const res = await setLogo(business.id, file);
    setLogoBusy(false);
    if (!res.ok) setLogoError(res.message);
  };
  const changeCover = async (file: File | null) => {
    setCoverBusy(true);
    setCoverError(null);
    const res = await setCover(business.id, file);
    setCoverBusy(false);
    if (!res.ok) setCoverError(res.message);
  };
  const [previewState, setPreviewState] = useState<CardStatus>("active");
  const b = business.branding;
  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => setJoinUrl(`${window.location.origin}/join/${business.slug}`), [business.slug]);

  const downloadQr = () => {
    const canvas = document.getElementById("join-qr-hires") as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${business.slug}.png`;
    a.click();
  };

  if (!program) return null;

  return (
    <RequirePermission allowed={!!membership && can(membership, "business.branding.edit")}>
      <PageHeader title="Tarjeta, QR y NFC" description="Personaliza la identidad visual que verán tus clientes. Los cambios se aplican al instante en todas las tarjetas." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Logotipo" description="Sube tu logo en PNG, JPG o SVG. Si no lo tienes, usamos tus iniciales." />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <BrandMark branding={b} className="size-16 rounded-full font-serif text-2xl" style={{ background: b.cardForeground, color: b.cardBackground }} />
              <div className="flex-1 space-y-2">
                <Field label="Iniciales" hint={b.logoUrl ? "Se mostrarán si quitas el logotipo." : "Se muestran mientras no subas un logotipo."}>
                  <Input maxLength={3} value={b.logoText} onChange={(e) => updateBranding(business.id, { logoText: e.target.value.toUpperCase() })} className="w-24" />
                </Field>
                {logoError && <p className="text-sm text-danger">{logoError}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) changeLogo(f);
                  }}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={logoBusy}>
                  {logoBusy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} {b.logoUrl ? "Cambiar logo" : "Subir logotipo"}
                </Button>
                {b.logoUrl && (
                  <Button variant="ghost" onClick={() => changeLogo(null)} disabled={logoBusy} aria-label="Quitar logotipo">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Foto de fondo" description="Una foto horizontal de tu local o tu producto. Se ve en la parte de arriba de la tarjeta y se funde con su color." />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas">
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageUp className="size-5 text-subtle" aria-hidden />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted">JPG o PNG de hasta 8 MB. La ajustamos sola para que cargue rápido.</p>
                {coverError && <p className="mt-1 text-sm text-danger">{coverError}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) changeCover(f);
                  }}
                />
                <Button variant="secondary" onClick={() => coverRef.current?.click()} disabled={coverBusy}>
                  {coverBusy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} {b.coverUrl ? "Cambiar foto" : "Subir foto"}
                </Button>
                {b.coverUrl && (
                  <Button variant="ghost" onClick={() => changeCover(null)} disabled={coverBusy} aria-label="Quitar foto de fondo">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Colores predeterminados" description="Elige uno y ajústalo abajo si quieres." />
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => updateBranding(business.id, p.colors)}
                  className="group rounded-xl border border-line p-2 text-left transition hover:border-line-strong hover:shadow-card"
                >
                  <div className="flex h-14 items-end rounded-lg p-2" style={{ background: p.colors.cardBackground }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-3 rounded-full" style={{ background: p.colors.cardForeground, opacity: i === 2 ? 0.3 : 1 }} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-medium">{p.name}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Sellos y tipografía" />
            <div className="space-y-5 p-5">
              <Field label="Icono del sello">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {STAMP_ICONS.map((key) => {
                    const Icon = STAMP_ICON_COMPONENTS[key];
                    const selected = (b.stampIcon ?? "check") === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateBranding(business.id, { stampIcon: key })}
                        aria-pressed={selected}
                        title={STAMP_ICON_LABELS[key]}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] transition",
                          selected ? "border-ink shadow-card" : "border-line hover:border-line-strong",
                        )}
                      >
                        <span className="flex size-9 items-center justify-center rounded-full" style={{ background: b.cardForeground, color: b.cardBackground }}>
                          <Icon className="size-4" strokeWidth={2.25} fill={FILLED_STAMP_ICONS.has(key) ? "currentColor" : "none"} />
                        </span>
                        {STAMP_ICON_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Tipografía del nombre">
                <Segmented<"serif" | "sans">
                  value={b.font ?? "serif"}
                  onChange={(font) => updateBranding(business.id, { font })}
                  options={[
                    { value: "serif", label: "Clásica" },
                    { value: "sans", label: "Moderna" },
                  ]}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Colores" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {COLOR_FIELDS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={b[key] as string}
                      onChange={(e) => updateBranding(business.id, { [key]: e.target.value })}
                      className="size-10 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
                    />
                    <Input value={b[key] as string} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && updateBranding(business.id, { [key]: e.target.value })} className="font-mono uppercase" />
                  </div>
                </Field>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="QR de inscripción" description="Imprímelo y ubícalo en caja o en tu espejo. Tus clientes lo escanean para crear su tarjeta." />
            <div className="flex flex-col items-center gap-6 p-5 sm:flex-row">
              <div className="rounded-2xl border border-line p-4" style={{ background: b.cardBackground }}>
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={joinUrl || `https://${PUBLIC_HOST_LABEL}/join/${business.slug}`} size={132} />
                </div>
                <p className="mt-3 text-center font-serif text-sm tracking-[0.15em] uppercase" style={{ color: b.cardForeground }}>
                  Únete a {program.name}
                </p>
              </div>
              <div className="flex-1 space-y-3 text-sm">
                <p className="font-mono text-xs break-all text-muted">{joinUrl.replace(/^https?:\/\//, "") || `${PUBLIC_HOST_LABEL}/join/${business.slug}`}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={downloadQr} disabled={!joinUrl}>
                    <Download className="size-4" /> Descargar PNG
                  </Button>
                  <a href={`/join/${business.slug}/poster`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                    <Printer className="size-4" /> Cartel para imprimir
                  </a>
                </div>
                {/* Versión en alta resolución para la descarga */}
                {joinUrl && (
                  <QRCodeCanvas id="join-qr-hires" value={joinUrl} size={1200} marginSize={4} level="M" className="hidden" />
                )}
              </div>
            </div>
          </Card>

          <NfcCard businessId={business.id} slug={business.slug} />
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Vista previa</p>
            <Segmented<CardStatus>
              value={previewState}
              onChange={setPreviewState}
              options={[
                { value: "active", label: "En progreso" },
                { value: "reward_available", label: "Recompensa" },
              ]}
            />
          </div>
          <div className="rounded-[36px] border border-line bg-[#f4f4f5] p-4">
            <LoyaltyCardView
              business={business}
              program={program}
              customerName="Sofía Martínez"
              stamps={previewState === "active" ? 6 : 0}
              status={previewState}
              rewardsAvailable={previewState === "active" ? 0 : 1}
              memberSince="jul. 2026"
            />
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
