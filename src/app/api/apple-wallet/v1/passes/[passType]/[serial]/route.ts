import { checkAuth } from "@/lib/wallet/apple";
import { appleWalletConfig } from "@/lib/wallet/config";
import { appOrigin, pkpassFor, pkpassResponse } from "@/lib/wallet/apple-server";

type Ctx = { params: Promise<{ passType: string; serial: string }> };

/** El iPhone pide la versión más reciente del pase (después de un aviso o al refrescar). */
export async function GET(req: Request, { params }: Ctx) {
  const { passType, serial } = await params;
  const cfg = appleWalletConfig();
  if (!cfg || passType !== cfg.passTypeId) return new Response(null, { status: 404 });
  if (!checkAuth(cfg, serial, req.headers.get("authorization"))) return new Response(null, { status: 401 });
  const pass = await pkpassFor(cfg, serial, appOrigin(req));
  return pass ? pkpassResponse(pass, serial) : new Response(null, { status: 404 });
}
