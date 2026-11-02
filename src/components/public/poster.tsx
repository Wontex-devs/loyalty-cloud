"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { PLATFORM_NAME } from "@/lib/config";
import type { BusinessBranding } from "@/lib/domain/types";
import { JoinUnavailable } from "./join-form";

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
          <div className="mx-auto flex size-[22mm] items-center justify-center rounded-full font-serif text-[9mm]" style={{ background: b.cardForeground, color: b.cardBackground }}>
            {b.logoText}
          </div>
          <p className="mt-[6mm] font-serif text-[13mm] leading-none tracking-[0.12em] uppercase">{business.name}</p>
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

export function DemoPoster({ slug }: { slug: string }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return null;
  const business = state.businesses.find((b) => b.slug === slug);
  const program = state.programs.find((p) => p.businessId === business?.id && p.active);
  if (!business || !program) return <JoinUnavailable />;
  return <Poster slug={slug} business={business} program={program} />;
}
