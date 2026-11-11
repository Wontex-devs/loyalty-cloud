import { NextResponse } from "next/server";
import { getPublicCard } from "@/lib/data/public";
import { googleWalletConfig } from "@/lib/wallet/config";
import { saveUrl } from "@/lib/wallet/google";
import { passFromCard } from "@/lib/wallet/pass";

type Ctx = { params: Promise<{ token: string }> };

/** Redirige a Google Wallet con el pase firmado de esta tarjeta. */
export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const cfg = googleWalletConfig();
  const card = cfg ? await getPublicCard(token) : null;
  if (!cfg || !card || card.status === "blocked") return NextResponse.redirect(new URL(`/card/${token}`, req.url));
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.redirect(saveUrl(cfg, passFromCard(card, origin), origin), { headers: { "Cache-Control": "no-store" } });
}
