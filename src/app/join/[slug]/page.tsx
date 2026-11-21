import type { Metadata } from "next";
import { getPublicBusinessSinSesion as getPublicBusiness } from "@/lib/data/public";
import { JoinForm, JoinUnavailable } from "@/components/public/join-form";

type Props = { params: Promise<{ slug: string }> };

// La página se guarda ya armada y se sirve al instante (es lo primero que ve quien escanea el cartel).
// Se vuelve a armar sola cada minuto, y de inmediato cuando el comercio cambia su marca o su programa.
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

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
