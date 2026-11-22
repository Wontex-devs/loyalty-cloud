import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appleWalletConfig, googleWalletConfig } from "@/lib/wallet/config";
import { dailyNotice } from "@/lib/wallet/messages";
import { deliverNotices, queueNotices } from "@/lib/wallet/notify";

export const maxDuration = 300;

/** Vercel Cron envía "Authorization: Bearer <CRON_SECRET>". Sin CRON_SECRET no se ejecuta. */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Proceso diario (vercel.json → crons): cumpleaños del día, "te extrañamos" y "te falta poco".
 * Solo a clientes que aceptaron mensajes; cada aviso se registra una vez, así que
 * ejecutarlo de nuevo el mismo día no repite nada.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  // Basta con una de las dos billeteras: el aviso llega por Google Wallet o al pase de Apple.
  if (!googleWalletConfig() && !appleWalletConfig()) return NextResponse.json({ ok: true, skipped: "wallet-disabled" });

  const { data, error } = await createAdminClient().rpc("wallet_daily_candidates");
  if (error) {
    console.error("[wallet-daily]", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  type Row = {
    business_id: string;
    card_id: string;
    public_token: string;
    kind: "birthday" | "winback" | "almost";
    ref: string;
    first_name: string;
    business_name: string;
    current_stamps: number;
    stamps_required: number;
    reward_name: string;
    message: string | null;
  };
  const rows = (data ?? []) as Row[];
  const queued = await queueNotices(
    rows.map((r) => ({
      businessId: r.business_id,
      cardId: r.card_id,
      token: r.public_token,
      ref: r.ref,
      notice: dailyNotice(r.kind, {
        firstName: r.first_name,
        businessName: r.business_name,
        stamps: r.current_stamps,
        required: r.stamps_required,
        rewardName: r.reward_name,
        message: r.message,
      }),
    })),
  );
  const counts = await deliverNotices(queued);
  return NextResponse.json({ ok: true, candidates: rows.length, queued: queued.length, ...counts });
}
