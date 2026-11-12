import Link from "next/link";
import { LogIn, Mail, MessageCircle } from "lucide-react";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { EMPRESA, SALES_WHATSAPP } from "@/lib/config";
import { PAGINAS } from "@/lib/contenido";

/**
 * Encabezado del sitio público. En la portada los enlaces van a sus secciones (#…);
 * en las demás páginas llevan a esas mismas secciones de la portada.
 */
export function EncabezadoSitio({ enPortada = false }: { enPortada?: boolean }) {
  const ir = (ancla: string) => (enPortada ? `#${ancla}` : `/#${ancla}`);
  const secciones = [
    ["como-funciona", "Cómo funciona"],
    ["planes", "Planes"],
    ["preguntas", "Preguntas"],
  ];
  return (
    <header className="on-cobalt sticky top-0 z-40 bg-cobalt text-white shadow-[0_10px_24px_-18px_rgb(6_10_36/0.8)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-8">
        <Link href="/" aria-label="Lazo, ir al inicio" className="whitespace-nowrap">
          <LazoLogo animar={enPortada} className="text-[32px]" markClassName="text-sun" />
        </Link>
        <nav className="flex items-center gap-4 text-[15px] font-medium sm:gap-5" aria-label="Principal">
          {secciones.map(([a, t]) => (
            <a key={a} href={ir(a)} className="hidden hover:underline lg:block">
              {t}
            </a>
          ))}
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-sun px-5 font-semibold text-coal shadow-[0_6px_16px_-8px_rgb(6_10_36/0.6)] transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]"
          >
            <LogIn className="size-4" aria-hidden />
            <span className="hidden sm:inline">Portal de clientes · Entrar</span>
            <span className="sm:hidden">Entrar</span>
          </Link>
        </nav>
      </div>
      {/* En celular y tableta los enlaces a cada sección van en una segunda fila */}
      <nav aria-label="Secciones" className="border-t border-white/15 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-2 text-sm font-medium sm:px-6">
          {secciones.map(([a, t]) => (
            <a key={a} href={ir(a)} className="flex h-11 items-center px-3 hover:underline">
              {t}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}

/** Pie del sitio: quién está detrás de Lazo, enlaces a las guías y a los textos legales. */
export function PieSitio() {
  const grupo = (...tipos: string[]) => PAGINAS.filter((p) => tipos.includes(p.tipo));
  const columnas: [string, ReturnType<typeof grupo>][] = [
    ["Guías", grupo("guia")],
    ["Por tipo de negocio", grupo("sector")],
    ["Empresa y legal", grupo("empresa", "legal")],
  ];
  return (
    <footer className="bg-sun text-coal">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <LazoLogo className="text-[30px]" markClassName="text-cobalt" />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed">Tarjeta de fidelización digital para negocios en Colombia.</p>
          <ul className="mt-5 space-y-2 text-[15px]">
            <li>
              <a href={`https://wa.me/${SALES_WHATSAPP}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
                <MessageCircle className="size-4" aria-hidden /> WhatsApp {EMPRESA.telefono.replace("+57 ", "")}
              </a>
            </li>
            <li>
              <a href={`mailto:${EMPRESA.correo}`} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
                <Mail className="size-4" aria-hidden /> {EMPRESA.correo}
              </a>
            </li>
          </ul>
        </div>
        {columnas.map(([titulo, paginas]) => (
          <nav key={titulo} aria-label={titulo}>
            <p className="font-semibold">{titulo}</p>
            <ul className="mt-3 space-y-2 text-[15px]">
              {paginas.map((p) => (
                <li key={p.ruta}>
                  <Link href={`/${p.ruta}`} className="underline-offset-2 hover:underline">
                    {p.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-coal/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm sm:px-8">
          Lazo es un producto de{" "}
          <a href={EMPRESA.web} className="underline underline-offset-2">
            {EMPRESA.nombre}
          </a>{" "}
          · {EMPRESA.ciudad} · NIT {EMPRESA.nit}
        </p>
      </div>
    </footer>
  );
}
