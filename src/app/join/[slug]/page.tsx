import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicBusiness } from "@/lib/data/public";
import { JoinForm, JoinUnavailable } from "@/components/public/join-form";
import { DemoJoin } from "@/components/public/demo-join";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = isSupabaseConfigured ? await getPublicBusiness(slug) : null;
  return { title: business ? `Únete a ${business.program.name}` : "Únete al programa" };
}

/** Destino del QR general del comercio. */
export default async function JoinPage({ params }: Props) {
  const { slug } = await params;
  if (!isSupabaseConfigured) return <DemoJoin slug={slug} />;

  const business = await getPublicBusiness(slug);
  if (!business) return <JoinUnavailable />;
  return <JoinForm slug={slug} business={business} program={business.program} live />;
}
