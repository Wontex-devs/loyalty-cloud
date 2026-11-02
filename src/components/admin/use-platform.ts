"use client";

import { useMemo } from "react";
import { useDemo } from "@/lib/demo/store";

/** Métricas agregadas por comercio. Live: RPC platform_business_stats. Demo: calculadas o estáticas. */
export function usePlatform() {
  const { state } = useDemo();
  return useMemo(() => {
    const d30 = Date.now() - 30 * 86400000;
    const rows = state.businesses.map((b) => {
      const plan = state.plans.find((p) => p.id === b.planId) ?? state.plans[0];
      const known = state.businessStats[b.id];
      const stats = known ?? {
            customers: state.customers.filter((c) => c.businessId === b.id).length,
            visits30d: state.visits.filter((v) => v.businessId === b.id && v.kind === "visit" && new Date(v.createdAt).getTime() > d30).length,
            rewards30d: state.redemptions.filter((r) => r.businessId === b.id && new Date(r.createdAt).getTime() > d30).length,
          };
      const owner = state.memberships.find((m) => m.businessId === b.id && m.role === "owner");
      return {
        business: b,
        plan,
        ...stats,
        owner: state.profiles.find((p) => p.id === owner?.profileId),
        staffCount: state.memberships.filter((m) => m.businessId === b.id).length,
      };
    });
    const mrr = rows.filter((r) => r.business.status === "active").reduce((s, r) => s + r.plan.priceMonthly, 0);
    return { rows, mrr, state };
  }, [state]);
}
