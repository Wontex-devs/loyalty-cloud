import { createAdminClient } from "@/lib/supabase/admin";
import { checkAuth } from "@/lib/wallet/apple";
import { appleWalletConfig } from "@/lib/wallet/config";
import { cardBySerial } from "@/lib/wallet/apple-server";

type Ctx = { params: Promise<{ device: string; passType: string; serial: string }> };

const DEVICE = /^[A-Za-z0-9_-]{1,128}$/;

async function authorize(req: Request, ctx: Ctx) {
  const { device, passType, serial } = await ctx.params;
  const cfg = appleWalletConfig();
  if (!cfg || passType !== cfg.passTypeId || !DEVICE.test(device)) return null;
  if (!checkAuth(cfg, serial, req.headers.get("authorization"))) return null;
  const card = await cardBySerial(serial);
  return card ? { device, ...card } : null;
}

/** El iPhone guardó el pase: registra el dispositivo y su token de avisos (protocolo de Apple). */
export async function POST(req: Request, ctx: Ctx) {
  const a = await authorize(req, ctx);
  if (!a) return new Response(null, { status: 401 });
  const body = (await req.json().catch(() => null)) as { pushToken?: unknown } | null;
  const pushToken = typeof body?.pushToken === "string" && /^[0-9a-fA-F]{16,200}$/.test(body.pushToken) ? body.pushToken : null;
  if (!pushToken) return new Response(null, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("apple_wallet_registrations")
    .select("push_token")
    .eq("device_library_id", a.device)
    .eq("card_id", a.cardId)
    .maybeSingle();
  const { error } = await admin
    .from("apple_wallet_registrations")
    .upsert({ device_library_id: a.device, card_id: a.cardId, business_id: a.businessId, push_token: pushToken }, { onConflict: "device_library_id,card_id" });
  if (error) {
    console.error("[apple-wallet] registro", error.message);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: existing ? 200 : 201 });
}

/** El iPhone eliminó el pase: deja de avisarle. */
export async function DELETE(req: Request, ctx: Ctx) {
  const a = await authorize(req, ctx);
  if (!a) return new Response(null, { status: 401 });
  await createAdminClient().from("apple_wallet_registrations").delete().eq("device_library_id", a.device).eq("card_id", a.cardId);
  return new Response(null, { status: 200 });
}
