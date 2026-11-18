import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { placesFrom, type Place } from "./geo";
import { mapsUrl, passInfoFrom, type PassInfo } from "./pass-info";

/** Ubicaciones de las sedes activas de un comercio (por id o por slug) para los pases. */
export async function businessPlaces(target: { businessId: string } | { slug: string }): Promise<Place[]> {
  const admin = createAdminClient();
  let businessId = "businessId" in target ? target.businessId : null;
  if (!businessId && "slug" in target) {
    const { data } = await admin.from("businesses").select("id").eq("slug", target.slug).maybeSingle();
    businessId = (data?.id as string | undefined) ?? null;
  }
  if (!businessId) return [];
  const { data, error } = await admin
    .from("locations")
    .select("latitude, longitude, active")
    .eq("business_id", businessId)
    .eq("active", true)
    .not("latitude", "is", null)
    .order("created_at");
  if (error) {
    console.error("[wallet] no se pudieron leer las sedes", error.message);
    return [];
  }
  return placesFrom(data ?? []);
}

/** Sedes y datos del reverso del pase (WhatsApp, Instagram, horario, dirección y mapa). */
export async function businessPassData(target: { businessId: string } | { slug: string }): Promise<{ places: Place[]; info: PassInfo }> {
  const admin = createAdminClient();
  let q = admin.from("businesses").select("id, address, city, pass_info");
  q = "businessId" in target ? q.eq("id", target.businessId) : q.eq("slug", target.slug);
  const { data } = await q.maybeSingle();
  if (!data) return { places: [], info: {} };
  const places = await businessPlaces({ businessId: data.id as string });
  const address = (data.address as string | null)?.trim() || undefined;
  const info: PassInfo = { ...passInfoFrom(data.pass_info), address, mapsUrl: mapsUrl(places, address, data.city as string) };
  return { places, info };
}
