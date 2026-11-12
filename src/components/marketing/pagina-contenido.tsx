import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { EncabezadoSitio, PieSitio } from "@/components/marketing/sitio";
import { fuenteTexto, fuenteTitulos, poster } from "@/components/marketing/fuentes";
import { EMPRESA, PLATFORM_NAME, SALES_WHATSAPP, SITE_URL } from "@/lib/config";
import { buscarPagina, type Pagina } from "@/lib/contenido";

const NOMBRE_TIPO = { guia: "Guías", sector: "Por tipo de negocio", empresa: "Empresa", legal: "Legal" } as const;

function fechaLarga(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** Datos para Google: guía = artículo; tipo de negocio = página del servicio; legal = página simple. Más su ruta de migas. */
function datosEstructurados(p: Pagina) {
  const url = `${SITE_URL}/${p.ruta}`;
  const organizacion = { "@id": `${SITE_URL}/#organizacion` };
  const paginaSimple = { "@type": "WebPage", "@id": `${url}#pagina`, url, name: p.h1, description: p.descripcion, inLanguage: "es-CO", dateModified: p.actualizado, publisher: organizacion, isPartOf: { "@id": `${SITE_URL}/#sitio` } };
  return {
    "@context": "https://schema.org",
    "@graph": [
      p.tipo === "legal"
        ? paginaSimple
        : p.tipo === "empresa"
        ? { ...paginaSimple, "@type": "AboutPage", about: organizacion, mainEntity: organizacion }
        : p.tipo === "sector"
        ? {
            ...paginaSimple,
            mainEntity: {
              "@type": "Service",
              "@id": `${url}#servicio`,
              name: p.h1,
              description: p.descripcion,
              serviceType: "Tarjeta de fidelización digital",
              provider: organizacion,
              areaServed: { "@type": "Country", name: "Colombia" },
              offers: { "@type": "Offer", url: `${SITE_URL}/#planes`, price: "79990.00", priceCurrency: "COP", availability: "https://schema.org/InStock" },
            },
          }
        : {
            "@type": "Article",
            "@id": `${url}#articulo`,
            mainEntityOfPage: url,
            headline: p.h1,
            description: p.descripcion,
            inLanguage: "es-CO",
            datePublished: p.actualizado,
            dateModified: p.actualizado,
            image: `${SITE_URL}/opengraph-image`,
            author: { "@type": "Organization", name: `${PLATFORM_NAME} (${EMPRESA.nombre})`, url: `${SITE_URL}/` },
            publisher: organizacion,
            isPartOf: { "@id": `${SITE_URL}/#sitio` },
          },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: p.h1, item: url },
        ],
      },
    ],
  };
}

/** Plantilla común de las guías, las páginas por tipo de negocio y los textos legales. */
export function PaginaContenido({ pagina: p }: { pagina: Pagina }) {
  const relacionadas = (p.relacionadas ?? []).map(buscarPagina).filter((r): r is Pagina => !!r);
  const whatsapp = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, leí «${p.h1}» y quiero saber más de ${PLATFORM_NAME}.`)}`;
  return (
    <div className={`${fuenteTitulos.variable} ${fuenteTexto.variable} bg-white font-[family-name:var(--font-text)] text-coal [&_h1]:text-balance [&_h2]:text-balance [&_p]:text-pretty`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados(p)).replace(/</g, "\\u003c") }} />
      <EncabezadoSitio />

      <div className="on-cobalt bg-cobalt text-white">
        <div className="mx-auto max-w-4xl px-4 pb-14 pt-8 sm:px-8 sm:pb-16">
          <nav aria-label="Migas de pan" className="text-sm text-white/80">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="underline-offset-2 hover:underline">
                  Inicio
                </Link>
              </li>
              <li aria-hidden>›</li>
              <li>{NOMBRE_TIPO[p.tipo]}</li>
            </ol>
          </nav>
          <p className="mt-8 text-lg font-semibold text-sun">{p.antetitulo}</p>
          <h1 className={`${poster} mt-2 text-[2.6rem] leading-[1.02] sm:text-6xl`}>{p.h1}</h1>
          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/90">{p.resumen}</p>
          <p className="mt-6 text-sm text-white/75">Actualizado el {fechaLarga(p.actualizado)}</p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-8 sm:py-20">
        <article className="space-y-14">
          {p.secciones.map((s) => (
            <section key={s.titulo}>
              <h2 className={`${poster} text-3xl leading-[1.08] sm:text-4xl`}>{s.titulo}</h2>
              <div className="mt-5 space-y-4 text-lg leading-relaxed text-graphite">
                {s.parrafos?.map((t) => <p key={t}>{t}</p>)}
                {s.pasos && (
                  <ol className="space-y-3">
                    {s.pasos.map((t, i) => (
                      <li key={t} className="flex gap-4">
                        <span className={`${poster} flex size-9 shrink-0 items-center justify-center rounded-full bg-sun text-lg text-coal`}>{i + 1}</span>
                        <span className="pt-1">{t}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {s.lista && (
                  <ul className="list-disc space-y-2 pl-6 marker:text-cobalt">
                    {s.lista.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {s.tabla && (
                  <div className="overflow-x-auto rounded-xl border-2 border-coal/10">
                    <table className="w-full min-w-[32rem] border-collapse text-left text-base">
                      <thead className="bg-[#eef1fd] text-coal">
                        <tr>
                          {s.tabla[0].map((c) => (
                            <th key={c} scope="col" className="px-4 py-3 font-semibold">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.tabla.slice(1).map((fila) => (
                          <tr key={fila.join("|")} className="border-t border-coal/10">
                            {fila.map((c, i) => (
                              <td key={i} className="px-4 py-3 align-top">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ))}

          {p.preguntas && p.preguntas.length > 0 && (
            <section>
              <h2 className={`${poster} text-3xl leading-[1.08] sm:text-4xl`}>Preguntas frecuentes</h2>
              <div className="mt-6 divide-y-2 divide-coal/10 border-y-2 border-coal/10">
                {p.preguntas.map((f) => (
                  <details key={f.q} className="faq group py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="text-2xl leading-none text-cobalt transition-transform group-open:rotate-45" aria-hidden>
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-[17px] leading-relaxed text-graphite">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </article>

        {p.tipo !== "legal" && (
          <aside className="mt-16 rounded-2xl bg-sun p-7 sm:p-10">
            <p className={`${poster} text-3xl leading-[1.05] sm:text-4xl`}>¿Quieres tu tarjeta de sellos digital?</p>
            <p className="mt-3 text-lg leading-relaxed">Te la dejamos lista con tu logo. El plan Starter tiene el primer mes gratis, IVA incluido y sin permanencia.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-coal px-5 font-semibold text-white transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]"
              >
                <MessageCircle className="size-5" aria-hidden /> Escríbenos por WhatsApp
              </a>
              <Link href="/#planes" className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-coal px-5 font-semibold transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]">
                Ver planes y precios
              </Link>
            </div>
          </aside>
        )}

        {relacionadas.length > 0 && (
          <nav aria-label="Páginas relacionadas" className="mt-16">
            <p className={`${poster} text-2xl`}>También te puede servir</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {relacionadas.map((r) => (
                <li key={r.ruta}>
                  <Link href={`/${r.ruta}`} className="group flex h-full items-start justify-between gap-3 rounded-xl border-2 border-coal/10 p-5 transition-colors hover:border-cobalt">
                    <span>
                      <span className="block text-sm text-graphite">{NOMBRE_TIPO[r.tipo]}</span>
                      <span className="mt-1 block font-semibold">{r.h1}</span>
                    </span>
                    <ArrowRight className="mt-1 size-5 shrink-0 text-cobalt transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <PieSitio />
    </div>
  );
}
