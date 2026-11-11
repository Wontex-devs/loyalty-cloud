import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicCard } from "@/lib/data/public";
import { PLATFORM_NAME } from "@/lib/config";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Manifiesto por tarjeta: al "añadir a la pantalla de inicio", el icono abre
 * directamente la tarjeta de ese cliente, con el nombre y colores del comercio.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const card = isSupabaseConfigured ? await getPublicCard(token) : null;
  const name = card?.business.name ?? PLATFORM_NAME;
  const b = card?.business.branding;
  const slug = card?.business.slug;
  const icon = (size: number) => (slug ? `/join/${slug}/icon/${size}` : `/join/_/icon/${size}`);

  return Response.json(
    {
      name: `${name} · Mi tarjeta`,
      short_name: name.slice(0, 12),
      start_url: `/card/${token}`,
      scope: `/card/${token}`,
      display: "standalone",
      orientation: "portrait",
      background_color: b?.cardBackground ?? "#ffffff",
      theme_color: b?.cardBackground ?? "#ffffff",
      icons: [
        { src: icon(192), sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icon(512), sizes: "512x512", type: "image/png", purpose: "any" },
        { src: icon(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, max-age=3600" } },
  );
}
