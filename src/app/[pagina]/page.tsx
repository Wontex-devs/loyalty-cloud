import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaContenido } from "@/components/marketing/pagina-contenido";
import { PLATFORM_NAME } from "@/lib/config";
import { buscarPagina, PAGINAS } from "@/lib/contenido";

type Props = { params: Promise<{ pagina: string }> };

/** Solo existen las páginas de src/lib/contenido; cualquier otra ruta da 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return PAGINAS.map((p) => ({ pagina: p.ruta }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = buscarPagina((await params).pagina);
  if (!p) return {};
  const titulo = p.titulo.includes(PLATFORM_NAME) || p.titulo.length > 52 ? p.titulo : `${p.titulo} · ${PLATFORM_NAME}`;
  return {
    title: { absolute: titulo },
    description: p.descripcion,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${p.ruta}` },
    openGraph: { type: "article", locale: "es_CO", siteName: PLATFORM_NAME, url: `/${p.ruta}`, title: p.h1, description: p.descripcion },
    twitter: { card: "summary_large_image" },
  };
}

export default async function Page({ params }: Props) {
  const p = buscarPagina((await params).pagina);
  if (!p) notFound();
  return <PaginaContenido pagina={p} />;
}
