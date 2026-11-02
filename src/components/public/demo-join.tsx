"use client";

import { useDemo } from "@/lib/demo/store";
import { JoinForm, JoinUnavailable } from "./join-form";

export function DemoJoin({ slug }: { slug: string }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <div className="min-h-dvh bg-white" />;
  const business = state.businesses.find((b) => b.slug === slug);
  const program = state.programs.find((p) => p.businessId === business?.id && p.active);
  if (!business || !program || business.status === "suspended") return <JoinUnavailable />;
  return <JoinForm slug={slug} business={business} program={program} />;
}
