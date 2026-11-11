import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/data/public";
import { Poster } from "@/components/public/poster";
import { JoinUnavailable } from "@/components/public/join-form";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cartel QR de inscripción", robots: { index: false } };

export default async function PosterPage({ params }: Props) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) return <JoinUnavailable />;
  return <Poster slug={slug} business={business} program={business.program} />;
}
