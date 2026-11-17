import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appleWalletConfig } from "@/lib/wallet/config";

type Ctx = { params: Promise<{ device: string; passType: string }> };

/**
 * Qué pases de este iPhone cambiaron desde la última vez (protocolo de Apple).
 * No pide autenticación: Apple no la envía aquí. Solo revela números de serie
 * a quien ya conoce el identificador del dispositivo, que es aleatorio y privado.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { device, passType } = await params;
  const cfg = appleWalletConfig();
  if (!cfg || passType !== cfg.passTypeId || !/^[A-Za-z0-9_-]{1,128}$/.test(device)) return new Response(null, { status: 404 });

  const since = Number(new URL(req.url).searchParams.get("passesUpdatedSince"));
  let q = createAdminClient()
    .from("apple_wallet_registrations")
    .select("pass_updated_at, loyalty_cards!inner(public_token)")
    .eq("device_library_id", device);
  if (Number.isFinite(since) && since > 0) q = q.gt("pass_updated_at", new Date(since).toISOString());
  const { data, error } = await q;
  if (error) return new Response(null, { status: 500 });
  if (!data?.length) return new Response(null, { status: 204 });

  const latest = Math.max(...data.map((r) => Date.parse(r.pass_updated_at)));
  const serialNumbers = data.map((r) => (r.loyalty_cards as unknown as { public_token: string }).public_token);
  return NextResponse.json({ serialNumbers, lastUpdated: String(latest) });
}
