"use client";

import { useDemo } from "@/lib/demo/store";
import { getProgress } from "@/lib/domain/loyalty-engine";
import { activePromotion } from "@/lib/domain/promotions";
import { CardScreen, NotFoundScreen } from "./card-screen";

/** Tarjeta en modo demo: se arma con el store del navegador (sincronizado entre pestañas). */
export function DemoCard({ token, isNew }: { token: string; isNew: boolean }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <div className="min-h-dvh bg-[#f4f4f5]" />;

  const card = state.cards.find((c) => c.publicToken === token);
  const business = state.businesses.find((b) => b.id === card?.businessId);
  const program = state.programs.find((p) => p.id === card?.programId);
  const customer = state.customers.find((c) => c.id === card?.customerId);
  if (!card || !business || !program || !customer || business.status === "suspended") {
    return <NotFoundScreen title="Tarjeta no encontrada" text="Revisa el enlace o pide ayuda en el establecimiento." />;
  }

  const progress = getProgress(card, program, state.rewards);
  return (
    <CardScreen
      isNew={isNew}
      data={{
        token,
        status: card.status,
        stamps: progress.stamps,
        totalVisits: card.totalVisits,
        customerName: customer.fullName,
        memberSince: customer.createdAt,
        business: { name: business.name, slug: business.slug, branding: business.branding },
        program: { name: program.name, stampsRequired: program.stampsRequired, rewardName: program.rewardName, terms: program.terms },
        rewards: state.rewards.filter((r) => r.cardId === card.id && r.status === "available").map((r) => ({ name: r.name, kind: r.kind, expiresAt: r.expiresAt })),
        recent: state.visits.filter((v) => v.cardId === card.id).slice(0, 5).map((v) => ({ kind: v.kind, delta: v.delta, bonus: v.bonusStamps, createdAt: v.createdAt })),
        promotion: (() => {
          const p = activePromotion((state.promotions ?? []).filter((x) => x.businessId === business.id));
          return p ? { name: p.name, bonusStamps: p.bonusStamps } : null;
        })(),
      }}
    />
  );
}
