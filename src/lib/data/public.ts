import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PublicCardData } from "@/components/public/card-screen";
import type { BusinessBranding, BusinessLegal } from "@/lib/domain/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const DEFAULT_BRANDING: BusinessBranding = {
  logoText: "",
  primary: "#1b3fd8",
  primaryForeground: "#ffc928",
  accent: "#ffc928",
  cardBackground: "#1b3fd8",
  cardForeground: "#ffc928",
};

/** Tarjeta pública por token (RPC get_public_card: vista mínima, sin teléfono ni correo). */
// cache: metadatos, viewport y página comparten una sola consulta por petición.
export const getPublicCard = cache(async (token: string): Promise<PublicCardData | null> => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_card", { p_token: token });
  if (!data) return null;
  const d = data as any;
  return {
    token: d.token,
    status: d.status,
    stamps: d.current_stamps,
    totalVisits: d.total_visits,
    customerName: d.customer_name,
    memberSince: d.member_since,
    business: { name: d.business.name, slug: d.business.slug, branding: { ...DEFAULT_BRANDING, ...d.business.branding } },
    program: { name: d.program.name, stampsRequired: d.program.stamps_required, rewardName: d.program.reward_name, terms: d.program.terms },
    rewards: (d.rewards ?? []).map((r: any) => ({ name: r.name, kind: r.kind ?? "cycle", expiresAt: r.expires_at })),
    recent: (d.recent ?? []).map((v: any) => ({ kind: v.kind, delta: v.delta, bonus: v.bonus ?? 0, createdAt: v.created_at })),
    promotion: d.promotion ? { name: d.promotion.name, bonusStamps: d.promotion.bonus_stamps } : null,
    marketingConsent: d.marketing_consent === true,
  };
});

export interface PublicBusiness {
  name: string;
  slug: string;
  city: string;
  legal: BusinessLegal;
  branding: BusinessBranding;
  program: { name: string; description: string; stampsRequired: number; rewardName: string; terms: string; rewardExpiryDays: number | null; welcomeStamps: number };
}

/** Ficha pública del comercio para /join (RPC get_public_business). */
export const getPublicBusiness = cache(async (slug: string): Promise<PublicBusiness | null> => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_business", { p_slug: slug });
  if (!data) return null;
  const d = data as any;
  return {
    name: d.name,
    slug: d.slug,
    city: d.city ?? "",
    legal: {
      legalName: d.legal?.legal_name ?? undefined,
      taxId: d.legal?.tax_id ?? undefined,
      contactEmail: d.legal?.contact_email ?? undefined,
      contactPhone: d.legal?.contact_phone ?? undefined,
      address: d.legal?.address ?? undefined,
    },
    branding: { ...DEFAULT_BRANDING, ...d.branding },
    program: {
      name: d.program.name,
      description: d.program.description,
      stampsRequired: d.program.stamps_required,
      rewardName: d.program.reward_name,
      terms: d.program.terms,
      rewardExpiryDays: d.program.reward_expiry_days ?? null,
      welcomeStamps: d.program.welcome_stamps ?? 0,
    },
  };
});
