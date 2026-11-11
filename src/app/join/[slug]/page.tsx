import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/data/public";
import { JoinForm, JoinUnavailable } from "@/components/public/join-form";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  return { title: business ? `Únete a ${business.program.name}` : "Únete al programa" };
}

/** Destino del QR general del comercio. */
export default async function JoinPage({ params }: Props) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) return <JoinUnavailable />;
  return <JoinForm slug={slug} business={business} program={business.program} />;
}
