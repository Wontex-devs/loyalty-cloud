"use server";

/**
 * Sello de prueba de la demo (/demo): quien tiene una tarjeta del comercio demo se suma un sello él mismo,
 * para ver en su celular cómo llega el sello y el aviso a la billetera. La regla vive en Postgres
 * (demo_add_stamp): solo en comercios marcados como demo, con freno de 10 segundos y 30 al día.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleCardWalletSync } from "@/lib/wallet/sync";
import { rateLimit } from "./rate-limit";

const input = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/), idempotencyKey: z.string().min(8).max(100) });

export type DemoSelloResult = { ok: true; premio: boolean } | { ok: false; message: string };

export async function demoSelloAction(token: string, idempotencyKey: string): Promise<DemoSelloResult> {
  const p = input.safeParse({ token, idempotencyKey });
  if (!p.success) return { ok: false, message: "Esta tarjeta no es válida." };
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`demo-ip:${ip}`, 60, 10 * 60_000)) return { ok: false, message: "Demasiados intentos. Espera unos minutos." };

  const { data, error } = await createAdminClient().rpc("demo_add_stamp", { p_card_token: p.data.token, p_idempotency_key: p.data.idempotencyKey });
  if (error) {
    const c = error.message ?? "";
    if (/DUPLICATE_REQUEST/.test(c)) return { ok: true, premio: false };
    if (/DEMO_TOO_FAST/.test(c)) return { ok: false, message: "Espera unos segundos antes del siguiente sello." };
    if (/DEMO_DAILY_LIMIT/.test(c)) return { ok: false, message: "Ya sumaste muchos sellos de prueba hoy. Vuelve mañana." };
    if (/NOT_DEMO/.test(c)) return { ok: false, message: "Esta tarjeta no es de la demo." };
    return { ok: false, message: "No se pudo sumar el sello. Inténtalo de nuevo." };
  }
  const res = data as { card_id: string; reward_id: string | null; birthday_reward_id?: string | null };
  // Igual que una visita real: actualiza el pase y manda el aviso a la billetera.
  scheduleCardWalletSync(res.card_id, { idempotencyKey: p.data.idempotencyKey, rewardEarned: !!res.reward_id, birthdayReward: !!res.birthday_reward_id }, { service: true });
  return { ok: true, premio: !!res.reward_id };
}
