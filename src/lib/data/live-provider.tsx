"use client";

/**
 * Proveedor de datos (Supabase) para los paneles. El estado llega del servidor
 * (ya filtrado por RLS); las escrituras van a Server Actions y luego se refresca.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { DataContext, type DataApi, type DataState } from "@/lib/data/store";
import { createClient } from "@/lib/supabase/client";
import { prepareCover, prepareLogo } from "@/lib/brand-image";
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
  anonymizeCustomerAction,
  revokeMarketingConsentAction,
  unsubscribeMarketingAction,
  savePromotionAction,
  logContactAction,
  sendWalletCampaignAction,
  updateWalletSettingsAction,
  saveLocationAction,
  setBusinessPlanAction,
  type OpActionResult,
} from "./loyalty-actions";

export function LiveProvider({ snapshot, children }: { snapshot: DataState; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState(snapshot);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const brandingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandingPatch = useRef<Record<string, unknown>>({});

  // Cada router.refresh() trae un snapshot nuevo del servidor.
  useEffect(() => setState(snapshot), [snapshot]);

  const api = useMemo<DataApi>(() => {
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

    // El navegador sube la imagen a Storage (las políticas limitan la carpeta al comercio)
    // y la acción del servidor guarda la URL, que Postgres vuelve a validar.
    const guardarImagen = async (
      businessId: string,
      file: File | null,
      campo: "logoUrl" | "coverUrl",
      nombre: string,
      extension: string,
      preparar: (f: File) => Promise<Blob>,
      etiqueta: string,
    ) => {
      const supabase = createClient();
      const bucket = supabase.storage.from("brand-assets");
      const previous = state.businesses.find((b) => b.id === businessId)?.branding[campo] ?? "";
      const prefix = bucket.getPublicUrl(`${businessId}/`).data.publicUrl;
      let path: string | null = null;
      let url = "";
      if (file) {
        let blob: Blob;
        try {
          blob = await preparar(file);
        } catch (e) {
          return { ok: false as const, message: e instanceof Error ? e.message : "No se pudo cargar la imagen." };
        }
        path = `${businessId}/${nombre}-${Date.now()}.${extension}`;
        const up = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (up.error) return { ok: false as const, message: `No se pudo subir ${etiqueta}. Inténtalo de nuevo.` };
        url = bucket.getPublicUrl(path).data.publicUrl;
      }
      const res = await updateBrandingAction(businessId, { [campo]: url });
      if (!res.ok) {
        if (path) await bucket.remove([path]);
        return res;
      }
      if (previous.startsWith(prefix)) await bucket.remove([previous.slice(prefix.length - businessId.length - 1)]);
      setState((s) => ({
        ...s,
        businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, branding: { ...b.branding, [campo]: url } } : b)),
      }));
      startTransition(() => router.refresh());
      return { ok: true as const };
    };

    return {
      state,
      // La inscripción pública no pasa por aquí: /join usa joinProgramAction directamente.
      registerVisit: async (cardId, idempotencyKey, locationId) => {
        const res = await registerVisitAction(cardId, idempotencyKey, locationId);
        if (res.ok) startTransition(() => router.refresh());
        return res;
      },
      reverseVisit: (visitId, reason) => refreshAfter(reverseVisitAction(visitId, reason)),
      redeemReward: (rewardId) => refreshAfter(redeemRewardAction(rewardId)),
      setCardBlocked: (cardId, blocked) => refreshAfter(setCardBlockedAction(cardId, blocked)),
      anonymizeCustomer: (customerId) => refreshAfter(anonymizeCustomerAction(customerId)),
      revokeMarketingConsent: (customerId) => refreshAfter(revokeMarketingConsentAction(customerId)),
      unsubscribeMarketing: unsubscribeMarketingAction,
      updateBusinessSettings: (businessId, input) => refreshAfter(updateBusinessSettingsAction(businessId, input)),
      savePromotion: (businessId, input, id) => refreshAfter(savePromotionAction(businessId, input, id)),
      logContact: (customerId, segment) => refreshAfter(logContactAction(customerId, segment)),
      updateWalletSettings: (businessId, settings) => refreshAfter(updateWalletSettingsAction(businessId, settings)),
      sendWalletCampaign: async (businessId, customerIds, title, body) => {
        const res = await sendWalletCampaignAction(businessId, customerIds, title, body);
        if (res.ok) startTransition(() => router.refresh());
        return res;
      },
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

      setLogo: (businessId, file) => guardarImagen(businessId, file, "logoUrl", "logo", "png", (f) => prepareLogo(f, 512), "el logotipo"),
      setCover: (businessId, file) => guardarImagen(businessId, file, "coverUrl", "foto", "jpg", (f) => prepareCover(f), "la foto"),

      setBusinessStatus: async (businessId, status) => {
        // Se espera la respuesta: la pantalla muestra el error si la base de datos lo rechaza.
        const res = await setBusinessStatusAction(businessId, status);
        if (res.ok) {
          setState((s) => ({ ...s, businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, status } : b)) }));
          startTransition(() => router.refresh());
          return { ok: true };
        }
        return { ok: false, message: res.message };
      },

      inviteStaff: (businessId, input) => {
        if (input.role === "owner") return;
        run(inviteStaffAction(businessId, { ...input, role: input.role }));
      },

      toggleMembership: (membershipId, patch) => {
        setState((s) => ({ ...s, memberships: s.memberships.map((m) => (m.id === membershipId ? { ...m, ...patch } : m)) }));
        run(updateMembershipAction(membershipId, patch));
      },

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
