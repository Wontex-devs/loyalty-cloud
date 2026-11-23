"use client";

/**
 * Proveedor de datos (Supabase) para los paneles. El estado llega del servidor
 * (ya filtrado por RLS); las escrituras van a Server Actions y luego se refresca.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { DataContext, type CampoImagenMarca, type DataApi, type DataState } from "@/lib/data/store";
import type { BusinessBranding } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/client";
import { prepareCover, prepareIlustracion, prepareLogo } from "@/lib/brand-image";
import type { ResultadoFondo } from "@/lib/domain/quitar-fondo";
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
  registerManualVisitAction,
  reverseVisitAction,
  setCardBlockedAction,
  anonymizeCustomerAction,
  adminDeleteCustomerAction,
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

    // La tarjeta muestra el sello nuevo al instante; el historial completo llega con el refresco.
    const applyVisit = (cardId: string, currentStamps: number) =>
      setState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId ? { ...c, currentStamps, totalVisits: c.totalVisits + 1, lastVisitAt: new Date().toISOString() } : c,
        ),
      }));

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
      campo: "logoUrl" | "coverUrl" | "stampUrl" | "illustrationUrl",
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
        if (res.ok) {
          applyVisit(cardId, res.data.currentStamps);
          startTransition(() => router.refresh());
        }
        return res;
      },
      registerManualVisit: async (cardId, idempotencyKey, reason, locationId) => {
        const res = await registerManualVisitAction(cardId, idempotencyKey, reason, locationId);
        if (res.ok) {
          applyVisit(cardId, res.data.currentStamps);
          startTransition(() => router.refresh());
        }
        return res;
      },
      reverseVisit: (visitId, reason) => refreshAfter(reverseVisitAction(visitId, reason)),
      redeemReward: (rewardId) => refreshAfter(redeemRewardAction(rewardId)),
      setCardBlocked: (cardId, blocked) => refreshAfter(setCardBlockedAction(cardId, blocked)),
      anonymizeCustomer: (customerId) => refreshAfter(anonymizeCustomerAction(customerId)),
      adminDeleteCustomer: (customerId) => refreshAfter(adminDeleteCustomerAction(customerId)),
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

      updateProgram: async (programId, patch) => {
        setState((s) => ({ ...s, programs: s.programs.map((p) => (p.id === programId ? { ...p, ...patch } : p)) }));
        const res = await updateProgramAction(programId, patch).catch(() => ({ ok: false as const, message: "No hay conexión. Intenta de nuevo." }));
        if (!res.ok) setToast(res.message);
        // Si falló, el refresco devuelve la página a lo que de verdad quedó guardado.
        startTransition(() => router.refresh());
        return res.ok ? { ok: true as const } : { ok: false as const, message: res.message };
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

      // Guardado con botón: se espera la respuesta y solo entonces se refleja en el panel.
      // Las imágenes pendientes se suben primero; si algo falla, se borran y no cambia nada.
      saveBranding: async (businessId, patch, imagenes = {}, letra) => {
        const bucket = createClient().storage.from("brand-assets");
        const prefix = bucket.getPublicUrl(`${businessId}/`).data.publicUrl;
        const actual = state.businesses.find((b) => b.id === businessId)?.branding;
        const nombres = { logoUrl: "logo", stampUrl: "sello", illustrationUrl: "ilustracion" } as const;
        const campos = Object.keys(nombres) as CampoImagenMarca[];
        const subidos: string[] = [];
        const completo: Partial<BusinessBranding> = { ...patch };
        for (const campo of campos) {
          const blob = imagenes[campo];
          if (blob === undefined) continue;
          if (blob === null) {
            completo[campo] = "";
            continue;
          }
          const path = `${businessId}/${nombres[campo]}-${Date.now()}.png`;
          const up = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
          if (up.error) {
            if (subidos.length) await bucket.remove(subidos);
            return { ok: false as const, message: "No se pudo subir una de las imágenes. Tus cambios siguen aquí: intenta de nuevo." };
          }
          subidos.push(path);
          completo[campo] = bucket.getPublicUrl(path).data.publicUrl;
        }
        // Letra propia: se sube su archivo (la vista previa usaba una dirección local «blob:»).
        if (letra === null) {
          completo.fontUrl = "";
          completo.fontName = "";
        } else if (letra) {
          const path = `${businessId}/letra-${Date.now()}.${letra.extension}`;
          const tipo = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff" }[letra.extension];
          const up = await bucket.upload(path, letra.archivo, { contentType: tipo, cacheControl: "31536000" });
          if (up.error) {
            if (subidos.length) await bucket.remove(subidos);
            return { ok: false as const, message: "No se pudo subir la letra. Tus cambios siguen aquí: intenta de nuevo." };
          }
          subidos.push(path);
          completo.fontUrl = bucket.getPublicUrl(path).data.publicUrl;
          completo.fontName = letra.nombre;
        } else if (completo.fontUrl?.startsWith("blob:")) {
          delete completo.fontUrl;
        }
        const res = await updateBrandingAction(businessId, completo);
        if (!res.ok) {
          if (subidos.length) await bucket.remove(subidos);
          return res;
        }
        // La letra vieja se borra del almacenamiento si se cambió o se quitó.
        if (letra !== undefined && actual?.fontUrl?.startsWith(prefix) && actual.fontUrl !== completo.fontUrl) {
          await bucket.remove([actual.fontUrl.slice(prefix.length - businessId.length - 1)]);
        }
        // Se borran del almacenamiento las imágenes viejas que ya no usa ningún campo (el sello puede ser el mismo logo).
        if (actual) {
          const nuevo = { ...actual, ...completo };
          const enUso = new Set(campos.map((c) => nuevo[c] ?? ""));
          const viejas = [...new Set(campos.map((c) => actual[c] ?? ""))].filter((u) => u.startsWith(prefix) && !enUso.has(u));
          if (viejas.length) await bucket.remove(viejas.map((u) => u.slice(prefix.length - businessId.length - 1)));
        }
        setState((s) => ({
          ...s,
          businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, branding: { ...b.branding, ...completo } } : b)),
        }));
        if (subidos.length || Object.keys(imagenes).length || letra !== undefined) startTransition(() => router.refresh());
        return { ok: true as const };
      },

      setLogo: (businessId, file) => guardarImagen(businessId, file, "logoUrl", "logo", "png", (f) => prepareLogo(f, 512), "el logotipo"),
      setCover: (businessId, file) => guardarImagen(businessId, file, "coverUrl", "foto", "jpg", (f) => prepareCover(f), "la foto"),
      // El sello se ve pequeño (un círculo de la tarjeta): 256 px bastan y carga rápido.
      setStamp: (businessId, file) => guardarImagen(businessId, file, "stampUrl", "sello", "png", (f) => prepareLogo(f, 256), "el sello"),
      // La ilustración ocupa el alto de la franja (336 px en el pase más grande): 600 px sobran.
      setIllustration: async (businessId, file, opciones) => {
        let fondo: ResultadoFondo | null = null;
        const res = await guardarImagen(
          businessId,
          file,
          "illustrationUrl",
          "ilustracion",
          "png",
          (f) => prepareIlustracion(f, 600, { quitarFondo: opciones?.quitarFondo, alTerminar: (r) => (fondo = r) }),
          "la ilustración",
        );
        if (!res.ok || !file || !opciones?.quitarFondo) return res;
        const aviso =
          fondo === "quitado"
            ? "Le quitamos el fondo a tu imagen."
            : fondo === "fondo-no-liso"
              ? "No encontramos un fondo liso para quitar (pasa con fotos): la subimos tal cual."
              : undefined;
        return aviso ? { ...res, aviso } : res;
      },

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
