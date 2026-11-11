import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/data/public";
import { JoinUnavailable } from "@/components/public/join-form";
import { LegalScreen } from "@/components/public/legal-screen";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Términos y tratamiento de datos" };

/** Términos del programa y política de datos que el cliente acepta al inscribirse. */
export default async function TermsPage({ params }: Props) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) return <JoinUnavailable />;
  return <LegalScreen data={{ slug, name: b.name, city: b.city, branding: b.branding, legal: b.legal, program: b.program }} />;
}
