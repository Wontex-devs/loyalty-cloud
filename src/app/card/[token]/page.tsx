import type { Metadata, Viewport } from "next";
import { getPublicCard } from "@/lib/data/public";
import { CardScreen, NotFoundScreen } from "@/components/public/card-screen";
import { isGoogleWalletEnabled } from "@/lib/wallet/config";
import { unsubscribeMarketingAction } from "@/lib/data/loyalty-actions";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> };

// La tarjeta es personal: no se indexa ni se cachea.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const card = await getPublicCard(token);
  const name = card?.business.name ?? "Mi tarjeta";
  return {
    title: "Mi tarjeta",
    robots: { index: false, follow: false },
    // Permite instalar la tarjeta como app: el icono abre esta misma tarjeta.
    manifest: `/card/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: card?.business.slug ? { apple: `/join/${card.business.slug}/icon/180` } : undefined,
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { token } = await params;
  const card = await getPublicCard(token);
  return { themeColor: card?.business.branding.cardBackground ?? "#ffffff" };
}

export default async function CardPage({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const isNew = sp.new === "1";
  const data = await getPublicCard(token);
  if (!data) return <NotFoundScreen title="Tarjeta no encontrada" text="Revisa el enlace o pide ayuda en el establecimiento." />;
  return <CardScreen data={data} isNew={isNew} googleWallet={isGoogleWalletEnabled()} onUnsubscribe={unsubscribeMarketingAction.bind(null, token)} />;
}
