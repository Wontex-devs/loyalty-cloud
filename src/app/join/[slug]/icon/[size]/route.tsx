import { getPublicBusiness } from "@/lib/data/public";
import { businessIcon } from "@/components/brand/business-icon";

type Ctx = { params: Promise<{ slug: string; size: string }> };

const SIZES = new Set([180, 192, 512, 660]);

/** Icono de la app de la tarjeta: logo (o iniciales) del comercio sobre sus colores. */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug, size: raw } = await params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const business = slug !== "_" ? await getPublicBusiness(slug) : null;
  return businessIcon(business, size, { headers: { "Cache-Control": "public, max-age=86400" } });
}
