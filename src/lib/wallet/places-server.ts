import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { placesFrom, type Place } from "./geo";

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
