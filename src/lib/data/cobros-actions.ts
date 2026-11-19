"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "./errors";

/**
 * Control de cobros a los comercios. Siempre con la sesión de quien mira: la base de datos solo deja
 * leer al equipo de la plataforma y solo deja registrar pagos al superadministrador (migración 0036).
 */

export interface PagoComercio {
  id: string;
  amount: number;
  paidOn: string;
  months: number;
  paidUntil: string;
  note: string | null;
  createdAt: string;
}

const AVISO_SIN_MIGRACION = "Falta aplicar en la base de datos la actualización de cobros (migración 0036).";
const faltaMigracion = (e: { code?: string; message?: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || /business_billing|business_payments/.test(e.message ?? "");

/** «Pagado hasta» de cada comercio: { id del comercio: "AAAA-MM-DD" }. */
export async function cargarCobrosAction(): Promise<{ fechas: Record<string, string>; aviso: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_billing").select("business_id, paid_until");
  if (error) {
    console.error("[cobros] fechas", error.message);
    return { fechas: {}, aviso: faltaMigracion(error) ? AVISO_SIN_MIGRACION : "No se pudieron cargar las fechas de pago." };
  }
  return { fechas: Object.fromEntries((data ?? []).map((r) => [r.business_id as string, r.paid_until as string])), aviso: null };
}

export async function pagosDelComercioAction(businessId: string): Promise<PagoComercio[]> {
  if (!z.uuid().safeParse(businessId).success) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_payments")
    .select("id, amount, paid_on, months, paid_until, note, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id as string,
    amount: Number(r.amount),
    paidOn: r.paid_on as string,
    months: Number(r.months),
    paidUntil: r.paid_until as string,
    note: (r.note as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisa la fecha.");
const pagoSchema = z.object({
  businessId: z.uuid(),
  monto: z.number().int("El monto va sin decimales.").min(0, "Revisa el monto.").max(100_000_000, "Revisa el monto."),
  fecha,
  meses: z.number().int().min(1, "Elige de 1 a 12 meses.").max(12, "Elige de 1 a 12 meses."),
  nota: z.string().trim().max(200, "La nota puede tener hasta 200 caracteres.").optional(),
});

export async function registrarPagoAction(input: z.input<typeof pagoSchema>): Promise<{ ok: true; pagadoHasta: string } | { ok: false; message: string }> {
  const p = pagoSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_business_payment", {
    p_business_id: p.data.businessId,
    p_amount: p.data.monto,
    p_paid_on: p.data.fecha,
    p_months: p.data.meses,
    p_note: p.data.nota || null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error, "No se pudo registrar el pago.") };
  revalidatePath("/admin", "layout");
  return { ok: true, pagadoHasta: String(data) };
}

const fechaSchema = z.object({
  businessId: z.uuid(),
  fecha,
  motivo: z.string().trim().min(3, "Escribe el motivo del cambio.").max(200, "El motivo puede tener hasta 200 caracteres."),
});

export async function cambiarPagadoHastaAction(input: z.input<typeof fechaSchema>): Promise<{ ok: true } | { ok: false; message: string }> {
  const p = fechaSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_paid_until", { p_business_id: p.data.businessId, p_paid_until: p.data.fecha, p_reason: p.data.motivo });
  if (error) return { ok: false, message: dbErrorMessage(error, "No se pudo cambiar la fecha.") };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
