import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicBusiness } from "@/lib/data/public";
import { NfcTap, NfcTapUnavailable } from "@/components/public/nfc-tap";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marcar visita" };

/** Destino de la etiqueta NFC del mostrador: `/tap/<slug>?k=<secreto de la etiqueta>`. */
export default async function TapPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { k } = await searchParams;
  if (!isSupabaseConfigured) return <NfcTapUnavailable demo />;

  const business = await getPublicBusiness(slug);
  if (!business) return <NfcTapUnavailable />;
  return <NfcTap slug={slug} secret={typeof k === "string" ? k : ""} business={{ name: business.name, branding: business.branding }} />;
}
