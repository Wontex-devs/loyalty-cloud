import { NextResponse } from "next/server";
import { getPublicCard } from "@/lib/data/public";
import { appleWalletConfig } from "@/lib/wallet/config";
import { appOrigin, pkpassFor, pkpassResponse } from "@/lib/wallet/apple-server";

type Ctx = { params: Promise<{ token: string }> };

/** Descarga el pase de Apple Wallet de esta tarjeta: el iPhone lo abre y ofrece «Añadir». */
export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const cfg = appleWalletConfig();
  const card = cfg ? await getPublicCard(token) : null;
  if (!cfg || !card || card.status === "blocked") return NextResponse.redirect(new URL(`/card/${token}`, req.url));
  const pass = await pkpassFor(cfg, token, appOrigin(req));
  if (!pass) return NextResponse.redirect(new URL(`/card/${token}`, req.url));
  return pkpassResponse(pass, token);
}
