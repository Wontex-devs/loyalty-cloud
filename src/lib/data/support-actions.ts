"use server";

/**
 * Ver o editar como el comercio: sesiones de soporte (migraciones 0021 y 0027).
 * - «read»: solo lectura, para superadministradores y Soporte.
 * - «edit»: el superadministrador entra con permisos de propietario.
 * La base de datos comprueba de nuevo el rol, limita la duración y deja la entrada en la auditoría del comercio.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { esSuperadmin, puedeVerPlataforma } from "@/lib/domain/acceso";
import { getSession } from "./queries";

export type SupportState = { error?: string } | null;

const schema = z.object({
  businessId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  reason: z.string().trim().min(5, "Escribe el motivo (mínimo 5 caracteres).").max(300, "El motivo es muy largo (máximo 300 caracteres)."),
  minutes: z.coerce.number().int().min(15).max(120).default(60),
  mode: z.enum(["read", "edit"]).default("read"),
});

/** Abre la sesión y lleva al panel del comercio. Se usa como acción de formulario. */
export async function startSupportSessionAction(_prev: SupportState, form: FormData): Promise<SupportState> {
  const parsed = schema.safeParse({
    businessId: form.get("businessId"),
    slug: form.get("slug"),
    reason: form.get("reason"),
    minutes: form.get("minutes") ?? undefined,
    mode: form.get("mode") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };

  const session = await getSession();
  if (!session || !puedeVerPlataforma(session.profile)) return { error: "No tienes permiso para entrar a este comercio." };
  if (parsed.data.mode === "edit" && !esSuperadmin(session.profile)) return { error: "Solo un superadministrador puede editar un comercio." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_support_session", {
    p_business_id: parsed.data.businessId,
    p_reason: parsed.data.reason,
    p_minutes: parsed.data.minutes,
    p_mode: parsed.data.mode,
  });
  if (error) {
    if (error.message.includes("REASON_REQUIRED")) return { error: "Escribe el motivo (mínimo 5 caracteres)." };
    if (error.message.includes("NOT_FOUND")) return { error: "No se encontró el comercio." };
    return { error: "No tienes permiso para entrar a este comercio." };
  }
  redirect(`/business/${parsed.data.slug}`);
}

/** Cierra la sesión y vuelve a la ficha del comercio en el panel de la plataforma. */
export async function endSupportSessionAction(businessId: string) {
  if (!z.uuid().safeParse(businessId).success) return;
  const supabase = await createClient();
  await supabase.rpc("end_support_session", { p_business_id: businessId });
  redirect(`/admin/businesses/${businessId}`);
}
