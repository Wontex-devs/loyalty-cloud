"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkoutUrl, isSandbox, wompiConfig } from "@/lib/pagos/wompi";
import { dbErrorMessage } from "./errors";

/**
 * Pago del plan en línea (Wompi), desde el panel del comercio. Siempre con la sesión de quien
 * paga: la base de datos solo deja al propietario o administrador (migración 0040).
 */

export interface EstadoPago {
  /** Wompi configurado en el servidor. */
  disponible: boolean;
  /** Llaves de pruebas: no se cobra de verdad. */
  pruebas: boolean;
  pagadoHasta: string | null;
  mesGratisPendiente: boolean;
  planId: string;
  planNombre: string;
  precioMensual: number;
  ordenes: { referencia: string; meses: number; valor: number; estado: string; creada: string; aplicada: boolean }[];
}

export async function estadoPagoAction(businessId: string): Promise<{ ok: true; estado: EstadoPago } | { ok: false; message: string }> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, message: "Comercio no válido." };
  const supabase = await createClient();
  const [b, o] = await Promise.all([
    supabase.rpc("my_billing", { p_business_id: businessId }),
    supabase
      .from("online_payments")
      .select("reference, months, amount_cents, status, created_at, applied_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (b.error) return { ok: false, message: dbErrorMessage(b.error, "No se pudo cargar tu plan.") };
  const fila = (b.data ?? [])[0];
  if (!fila) return { ok: false, message: "Solo el propietario o un administrador ve el pago del plan." };
  const cfg = wompiConfig();
  return {
    ok: true,
    estado: {
      disponible: !!cfg,
      pruebas: !!cfg && isSandbox(cfg),
      pagadoHasta: (fila.paid_until as string | null) ?? null,
      mesGratisPendiente: fila.free_month_pending === true,
      planId: fila.plan_id as string,
      planNombre: fila.plan_name as string,
      precioMensual: Number(fila.price_monthly),
      ordenes: (o.data ?? []).map((r) => ({
        referencia: r.reference as string,
        meses: Number(r.months),
        valor: Number(r.amount_cents) / 100,
        estado: r.status as string,
        creada: r.created_at as string,
        aplicada: !!r.applied_at,
      })),
    },
  };
}

const iniciarSchema = z.object({ businessId: z.uuid(), meses: z.number().int().min(1).max(12) });

/** Crea la orden en la base de datos (el valor lo pone ella) y devuelve el enlace al pago de Wompi. */
export async function iniciarPagoAction(businessId: string, meses: number): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const p = iniciarSchema.safeParse({ businessId, meses });
  if (!p.success) return { ok: false, message: "Elige de 1 a 12 meses." };
  const cfg = wompiConfig();
  if (!cfg) return { ok: false, message: "El pago en línea todavía no está disponible. Escríbenos por WhatsApp para pagar." };
  const supabase = await createClient();
  const [{ data: user }, { data: biz }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("businesses").select("slug").eq("id", businessId).maybeSingle(),
  ]);
  if (!biz?.slug) return { ok: false, message: "Comercio no válido." };
  const { data, error } = await supabase.rpc("start_online_payment", { p_business_id: businessId, p_months: p.data.meses });
  if (error) return { ok: false, message: dbErrorMessage(error, "No se pudo iniciar el pago.") };
  const orden = (data ?? [])[0] as { reference: string; amount_cents: number } | undefined;
  if (!orden) return { ok: false, message: "No se pudo iniciar el pago." };
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return {
    ok: true,
    url: checkoutUrl(cfg, {
      reference: orden.reference,
      amountInCents: Number(orden.amount_cents),
      redirectUrl: `${origin}/business/${biz.slug}/settings?pago=${orden.reference}`,
      email: user.user?.email ?? undefined,
    }),
  };
}
