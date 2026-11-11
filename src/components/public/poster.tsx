"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { PLATFORM_NAME } from "@/lib/config";
import type { BusinessBranding } from "@/lib/domain/types";
import { BrandMark, brandFont } from "@/components/loyalty/brand-mark";
import { cn } from "@/lib/utils";

interface PosterProps {
  slug: string;
  business: { name: string; branding: BusinessBranding };
  program: { name: string; stampsRequired: number; rewardName: string };
}

/** Cartel imprimible con el QR general de inscripción (tamaño carta / A4). */
export function Poster({ slug, business, program }: PosterProps) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${window.location.origin}/join/${slug}`), [slug]);
  const b = business.branding;

  return (
    <div className="min-h-dvh bg-[#e5e5e5] py-8 print:bg-white print:py-0">
      <style>{`@page { size: auto; margin: 0; } @media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end px-4">
        <button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white">
          <Printer className="size-4" /> Imprimir o guardar PDF
        </button>
      </div>
      <div
        className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between px-[12mm] py-[16mm] text-center shadow-pop print:shadow-none"
        style={{ background: b.cardBackground, color: b.cardForeground }}
      >
        <div>
          <BrandMark branding={b} className={`mx-auto size-[22mm] rounded-full text-[9mm] ${brandFont(b)}`} style={{ background: b.cardForeground, color: b.cardBackground }} />
          <p className={cn("mt-[6mm] text-[13mm] leading-none uppercase", brandFont(b, "tracking-[0.12em]"))}>{business.name}</p>
          {program.name.trim().toLowerCase() !== business.name.trim().toLowerCase() && (
            <p className="mt-[3mm] text-[4.2mm] tracking-[0.3em] uppercase opacity-60">{program.name}</p>
          )}
        </div>

        <div>
          <p className="font-serif text-[10mm] leading-tight">Escanea y únete</p>
          <div className="mx-auto mt-[6mm] w-fit rounded-[6mm] bg-white p-[6mm]">
            {url && <QRCodeSVG value={url} size={720} level="M" style={{ width: "80mm", height: "80mm" }} />}
          </div>
          <p className="mt-[6mm] text-[5mm] font-medium">
            {program.stampsRequired} visitas = {program.rewardName}
          </p>
          <p className="mt-[2mm] text-[3.6mm] opacity-70">Sin descargar aplicaciones · Tu tarjeta en el celular</p>
        </div>

        <p className="text-[3mm] opacity-50">
          {url.replace(/^https?:\/\//, "")} · {PLATFORM_NAME}
        </p>
      </div>
    </div>
  );
}

