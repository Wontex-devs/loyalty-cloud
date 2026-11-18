"use server";

/**
 * Qué clientes tienen guardada su tarjeta en la billetera del celular.
 *  * Apple: los iPhone registrados en nuestro servicio web (Apple los borra al quitar el pase).
 *  * Google: los objetos del comercio en Google Wallet con hasUsers = true.
 * El acceso lo decide RLS: solo se consultan tarjetas que el usuario puede ver.
 */
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "./fetch-all";
import { googleWalletConfig } from "@/lib/wallet/config";
import { listObjects, savedTokens } from "@/lib/wallet/google";
import type { WalletKind } from "@/lib/wallet/invite";

export type WalletStatusResult =
  | { ok: true; byCard: Record<string, WalletKind[]>; googleChecked: boolean }
  | { ok: false; message: string };

const cache = new Map<string, { at: number; tokens: Set<string> }>();
const TTL = 60_000;

async function googleTokens(slug: string) {
  const cfg = googleWalletConfig();
  if (!cfg) return null;
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL) return hit.tokens;
  const tokens = savedTokens(cfg, await listObjects(cfg, slug));
  cache.set(slug, { at: Date.now(), tokens });
  return tokens;
}

export async function walletStatusAction(businessId: string): Promise<WalletStatusResult> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Comercio no válido." };
  const supabase = await createClient();
  const { data: biz } = await supabase.from("businesses").select("slug").eq("id", businessId).maybeSingle();
  if (!biz?.slug) return { ok: false, message: "No tienes acceso a este comercio." };
  const cards = (await fetchAll((from, to) =>
    supabase.from("loyalty_cards").select("id, public_token").eq("business_id", businessId).order("created_at").range(from, to),
  )) as { id: string; public_token: string }[];

  const byCard: Record<string, WalletKind[]> = {};
  const add = (id: string, kind: WalletKind) => {
    if (!(byCard[id] ??= []).includes(kind)) byCard[id].push(kind);
  };
  const ids = new Set(cards.map((c) => c.id));

  const admin = createAdminClient();
  const apple = (await fetchAll((from, to) =>
    admin.from("apple_wallet_registrations").select("card_id").eq("business_id", businessId).range(from, to),
  )) as { card_id: string }[];
  for (const r of apple) if (ids.has(r.card_id)) add(r.card_id, "apple");

  let googleChecked = false;
  try {
    const tokens = await googleTokens(biz.slug);
    if (tokens) {
      for (const c of cards) if (tokens.has(c.public_token)) add(c.id, "google");
      googleChecked = true;
    }
  } catch (e) {
    console.error("[wallet-status] Google", e instanceof Error ? e.message : e);
  }
  return { ok: true, byCard, googleChecked };
}
