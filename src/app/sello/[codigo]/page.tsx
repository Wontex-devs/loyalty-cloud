import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { esCodigoTarjeta } from "@/lib/domain/code128";

type Props = { params: Promise<{ codigo: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sumar sello", robots: { index: false, follow: false } };

/**
 * A esta dirección lleva el código QR de cada tarjeta. Quien atiende puede escanearlo con la cámara normal
 * del celular: con sesión de un negocio al que pertenece la tarjeta, se abre «Escanear tarjeta» y se suma el sello
 * con las mismas reglas de siempre. A cualquier otra persona no se le muestra nada de la tarjeta (RLS lo impide):
 * solo un aviso de cómo se usa.
 */
export default async function SelloPage({ params }: Props) {
  const { codigo } = await params;
  if (!esCodigoTarjeta(codigo)) return <Aviso titulo="Código no válido" texto="Este código no es de una tarjeta de Lazo." />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Aviso
        titulo="Tarjeta de fidelización"
        texto="Este código lo escanea el negocio para sumar tu sello. Si trabajas ahí, inicia sesión y se sumará el sello."
        enlace={{ href: `/login?next=${encodeURIComponent(`/sello/${codigo}`)}`, texto: "Iniciar sesión" }}
      />
    );
  }

  // RLS: solo aparecen las tarjetas de los negocios de este usuario.
  const { data } = await supabase.from("loyalty_cards").select("businesses(slug)").eq("scan_code", codigo).limit(1).maybeSingle();
  const slug = (data?.businesses as unknown as { slug?: string } | null)?.slug;
  if (!slug) {
    return (
      <Aviso
        titulo="Esta tarjeta no es de tu negocio"
        texto="Revisa que hayas entrado con el usuario del negocio donde el cliente tiene su tarjeta."
        enlace={{ href: "/start", texto: "Ir a mi panel" }}
      />
    );
  }
  redirect(`/business/${slug}/escanear?codigo=${codigo}`);
}

function Aviso({ titulo, texto, enlace }: { titulo: string; texto: string; enlace?: { href: string; texto: string } }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-center">
      <div className="max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card">
        <ScanLine className="mx-auto size-9 text-muted" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">{titulo}</h1>
        <p className="mt-1 text-sm text-muted">{texto}</p>
        {enlace && (
          <Link href={enlace.href} className="mt-5 inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white">
            {enlace.texto}
          </Link>
        )}
      </div>
    </div>
  );
}
