"use client";

/**
 * Proveedor de datos en modo live (Supabase). Expone la misma interfaz que el
 * store demo para que las pantallas no cambien. El estado llega del servidor
 * (ya filtrado por RLS); las escrituras van a Server Actions y luego se refresca.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { DataContext, type DemoApi, type DemoState } from "@/lib/demo/store";
import { createClient } from "@/lib/supabase/client";
import { prepareLogo } from "@/lib/brand-image";
import {
  inviteStaffAction,
  setBusinessStatusAction,
  updateBrandingAction,
  updateBusinessSettingsAction,
  updateMembershipAction,
  updateProgramAction,
  type ActionResult,
} from "./actions";
import {
  exportCustomersAction,
  getBusinessStatsAction,
  redeemRewardAction,
  registerVisitAction,
  reverseVisitAction,
  setCardBlockedAction,
  savePromotionAction,
  logContactAction,
  saveLocationAction,
  setBusinessPlanAction,
  type OpActionResult,
} from "./loyalty-actions";

export function LiveProvider({ snapshot, children }: { snapshot: DemoState; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState(snapshot);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const brandingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandingPatch = useRef<Record<string, unknown>>({});

  // Cada router.refresh() trae un snapshot nuevo del servidor.
  useEffect(() => setState(snapshot), [snapshot]);

  const api = useMemo<DemoApi>(() => {
    const run = (p: Promise<ActionResult>) =>
      startTransition(async () => {
        const res = await p;
        if (!res.ok) setToast(res.message);
        else if (res.message) setToast(res.message);
        router.refresh();
      });

    // Operaciones cuyo resultado muestra la propia pantalla: se espera la respuesta y luego se refresca.
    const refreshAfter = async (p: Promise<OpActionResult>) => {
      const res = await p;
      if (res.ok) startTransition(() => router.refresh());
      return res;
    };

    return {
      mode: "live",
      state,
      hydrated: true,
      setActingProfile: () => {},
      // La inscripción pública no pasa por aquí: /join usa joinProgramAction directamente.
      joinProgram: async () => ({ ok: false, message: "No disponible desde el panel." }),
      registerVisit: async (cardId, idempotencyKey, locationId) => {
        const res = await registerVisitAction(cardId, idempotencyKey, locationId);
        if (res.ok) startTransition(() => router.refresh());
        return res;
      },
      reverseVisit: (visitId, reason) => refreshAfter(reverseVisitAction(visitId, reason)),
      redeemReward: (rewardId) => refreshAfter(redeemRewardAction(rewardId)),
      setCardBlocked: (cardId, blocked) => refreshAfter(setCardBlockedAction(cardId, blocked)),
      updateBusinessSettings: (businessId, input) => refreshAfter(updateBusinessSettingsAction(businessId, input)),
      savePromotion: (businessId, input, id) => refreshAfter(savePromotionAction(businessId, input, id)),
      logContact: (customerId, segment) => refreshAfter(logContactAction(customerId, segment)),
      saveLocation: (businessId, input, id) => refreshAfter(saveLocationAction(businessId, input, id)),
      setBusinessPlan: (businessId, planId) => refreshAfter(setBusinessPlanAction(businessId, planId)),
      getStats: getBusinessStatsAction,
      exportCustomers: exportCustomersAction,

      updateProgram: (programId, patch) => {
        setState((s) => ({ ...s, programs: s.programs.map((p) => (p.id === programId ? { ...p, ...patch } : p)) }));
        run(updateProgramAction(programId, patch));
      },

      // Los selectores de color disparan muchos cambios: se agrupan antes de guardar.
      updateBranding: (businessId, patch) => {
        setState((s) => ({
          ...s,
          businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, branding: { ...b.branding, ...patch } } : b)),
        }));
        brandingPatch.current = { ...brandingPatch.current, ...patch };
        if (brandingTimer.current) clearTimeout(brandingTimer.current);
        brandingTimer.current = setTimeout(() => {
          const p = brandingPatch.current;
          brandingPatch.current = {};
          run(updateBrandingAction(businessId, p));
        }, 700);
      },

      // El navegador sube la imagen a Storage (las políticas limitan la carpeta al comercio)
      // y la acción del servidor guarda la URL, que Postgres vuelve a validar.
      setLogo: async (businessId, file) => {
        const supabase = createClient();
        const bucket = supabase.storage.from("brand-assets");
        const previous = state.businesses.find((b) => b.id === businessId)?.branding.logoUrl ?? "";
        const prefix = bucket.getPublicUrl(`${businessId}/`).data.publicUrl;
        let path: string | null = null;
        let logoUrl = "";
        if (file) {
          let blob: Blob;
          try {
            blob = await prepareLogo(file, 512);
          } catch (e) {
            return { ok: false, message: e instanceof Error ? e.message : "No se pudo cargar la imagen." };
          }
          path = `${businessId}/logo-${Date.now()}.png`;
          const up = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
          if (up.error) return { ok: false, message: "No se pudo subir el logotipo. Inténtalo de nuevo." };
          logoUrl = bucket.getPublicUrl(path).data.publicUrl;
        }
        const res = await updateBrandingAction(businessId, { logoUrl });
        if (!res.ok) {
          if (path) await bucket.remove([path]);
          return res;
        }
        if (previous.startsWith(prefix)) await bucket.remove([previous.slice(prefix.length - businessId.length - 1)]);
        setState((s) => ({
          ...s,
          businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, branding: { ...b.branding, logoUrl } } : b)),
        }));
        startTransition(() => router.refresh());
        return { ok: true };
      },

      setBusinessStatus: (businessId, status) => {
        setState((s) => ({ ...s, businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, status } : b)) }));
        run(setBusinessStatusAction(businessId, status));
      },

      inviteStaff: (businessId, input) => {
        if (input.role === "owner") return;
        run(inviteStaffAction(businessId, { ...input, role: input.role }));
      },

      toggleMembership: (membershipId, patch) => {
        setState((s) => ({ ...s, memberships: s.memberships.map((m) => (m.id === membershipId ? { ...m, ...patch } : m)) }));
        run(updateMembershipAction(membershipId, patch));
      },

      reset: () => router.refresh(),
    };
  }, [state, router]);

  return (
    <DataContext.Provider value={api}>
      {children}
      {toast && (
        <div className="animate-fade-up fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-pop">
          <p className="flex-1">{toast}</p>
          <button onClick={() => setToast(null)} aria-label="Cerrar">
            <X className="size-4 text-muted" />
          </button>
        </div>
      )}
    </DataContext.Provider>
  );
}
