import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { BrandPreview } from "@/components/marketing/brand-preview";
import { EscenaCliente } from "@/components/marketing/escena-cliente";
import { Mascota, NudoDibujo } from "@/components/marketing/mascota";
import { NfcAnimacion } from "@/components/marketing/nfc-animacion";
import { WalletPhone } from "@/components/marketing/wallet-phone";
import { EncabezadoSitio, PieSitio } from "@/components/marketing/sitio";
import { fuenteTexto, fuenteTitulos, poster } from "@/components/marketing/fuentes";
import { EMPRESA, PLATFORM_NAME, SALES_WHATSAPP, SITE_URL } from "@/lib/config";
import { PAGINAS } from "@/lib/contenido";

export const metadata: Metadata = {
  title: { absolute: `${PLATFORM_NAME} · Tarjeta de fidelización digital para tu negocio` },
  description: "Tarjeta de sellos digital con tu marca, en Google Wallet y con sellos por NFC. Planes desde $79.990 al mes, IVA incluido y sin permanencia.",
  // Su dominio propio es la dirección principal en buscadores.
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: PLATFORM_NAME,
    url: "/",
    title: "Tarjeta de sellos digital para que tus clientes vuelvan",
    description: "Tarjeta de fidelización con la marca de tu negocio: tus clientes la guardan en Google Wallet y suman sellos acercando el celular.",
  },
  twitter: { card: "summary_large_image" },
};

const whatsappLink = (text: string) => `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
const whatsappHref = whatsappLink(`Hola, quiero mi primer mes gratis del plan Starter de ${PLATFORM_NAME}.`);

const h2 = `${poster} text-balance text-4xl leading-[1.02] sm:text-6xl`;
const btn = "inline-flex h-14 items-center justify-center gap-2.5 rounded-lg px-6 text-base font-semibold transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]";

const PLANS = [
  { name: "Starter", who: "Para un local que empieza", lines: ["100 clientes", "2 personas del equipo", "1 sede"], price: "$79.990", chip: "Primer mes gratis", cta: "Quiero mi primer mes gratis", freeMonth: true },
  { name: "Pro", who: "Para el negocio que ya tiene movimiento", lines: ["300 clientes", "10 personas del equipo", "3 sedes"], price: "$139.990", chip: "Recomendado", cta: "Quiero este plan", featured: true },
  { name: "Business", who: "Para cadenas y varias sedes", lines: ["Clientes a tu medida", "Equipo a tu medida", "Sedes a tu medida"], price: "A medida", cta: "Hablemos de tu negocio", custom: true },
];

const FAQ = [
  { q: "¿Qué es Lazo?", a: "Lazo es una plataforma colombiana de tarjetas de fidelización digitales para negocios locales. Cada negocio tiene su tarjeta de sellos con su marca, sus clientes la guardan en Google Wallet y suman sellos acercando el celular a una etiqueta NFC del mostrador. El dueño ve en un panel quién vuelve, quién dejó de venir y a quién avisarle." },
  { q: "¿Cómo funciona el primer mes gratis?", a: "Aplica al plan Starter. Te dejamos la tarjeta lista con tu marca y la usas un mes sin pagar. Si decides seguir, pagas $79.990 al mes, con IVA incluido." },
  { q: "¿Los precios incluyen IVA? ¿Hay permanencia?", a: "Sí, los precios ya incluyen el IVA. Se paga mes a mes y no hay permanencia mínima: puedes cancelar cuando quieras escribiéndonos por WhatsApp o a info@wontex-devs.com, y no se cobra el mes siguiente." },
  { q: "¿Mis clientes tienen que descargar algo?", a: "No. Tu cliente crea su tarjeta escaneando el QR de tu negocio, desde el navegador del celular. En Android la guarda en Google Wallet con un botón. En iPhone la abre desde su enlace en el navegador, sin instalar nada." },
  { q: "¿Necesito comprar algún equipo?", a: "No necesitas lector ni datáfono. Basta una etiqueta NFC adhesiva (tipo NTAG213 o NTAG215), que se pega en el mostrador y se activa desde tu panel. El QR solo se usa una vez, para que tu cliente cree su tarjeta; lo pones en un cartel en la caja." },
  { q: "¿Qué pasa si mi cliente cambia de celular?", a: "Vuelve a escanear el QR de tu negocio con el mismo nombre y celular, y recupera su tarjeta con todos sus sellos." },
  { q: "¿Sirve para mi tipo de negocio?", a: "Sirve para cualquier negocio con clientes que repiten: barberías, salones, cafeterías, panaderías, spas, gimnasios, lavaderos, tiendas y más." },
  { q: "¿Se pueden hacer trampas con los sellos?", a: "Hay varios frenos. Entre dos sellos debe pasar un tiempo mínimo que tú eliges, y el sistema bloquea los toques repetidos. Cada sello queda registrado con fecha y hora, y puedes anularlo desde el historial. Si sospechas que alguien copió la etiqueta, la cambias desde tu panel y la anterior deja de funcionar." },
  { q: "¿Quién ve los datos de mis clientes?", a: "Los datos de tus clientes son de tu negocio. Lazo los guarda solo para operar tu tarjeta, como encargado según la Ley 1581 de 2012, y no los vende ni los comparte con otros negocios. Tus clientes aceptan la política de datos al inscribirse, pueden dejar de recibir avisos desde su tarjeta y pedirte que borres sus datos." },
  { q: "¿La tarjeta de lealtad queda en Google Wallet?", a: "Sí. En Android la tarjeta queda en Google Wallet con tu logo, tus colores y los sellos al día: cada sello nuevo se actualiza solo en la billetera del cliente. En iPhone, por ahora, la tarjeta se usa desde el navegador." },
  { q: "¿Funciona con varias sedes?", a: "Sí. El plan Starter incluye una sede, el Pro hasta tres y el Business las que necesites. Cada persona de tu equipo tiene su propio usuario." },
];

function Punch({ bg, hole }: { bg: string; hole: string }) {
  return <div aria-hidden className="punch-row" style={{ "--punch-bg": bg, "--punch-hole": hole } as React.CSSProperties} />;
}

function WhatsAppButton({ className }: { className: string }) {
  return (
    <a href={whatsappHref} target="_blank" rel="noopener" className={`${btn} ${className}`}>
      <MessageCircle className="size-5" /> Quiero mi primer mes gratis
    </a>
  );
}

/** Datos estructurados para Google: la empresa, el producto con sus precios y las preguntas frecuentes. */
function datosEstructurados() {
  const id = (parte: string) => `${SITE_URL}/#${parte}`;
  const descripcion = FAQ[0].a;
  const plan = (nombre: string, precio: number, detalle: string) => ({
    "@type": "Offer",
    name: `Plan ${nombre}`,
    description: detalle,
    url: `${SITE_URL}/#planes`,
    price: `${precio}.00`,
    priceCurrency: "COP",
    availability: "https://schema.org/InStock",
    seller: { "@id": id("organizacion") },
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: `${precio}.00`,
      priceCurrency: "COP",
      billingDuration: "P1M",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    },
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": id("organizacion"),
        name: PLATFORM_NAME,
        url: `${SITE_URL}/`,
        description: descripcion,
        email: EMPRESA.correo,
        address: { "@type": "PostalAddress", addressLocality: EMPRESA.localidad, addressRegion: EMPRESA.region, addressCountry: "CO" },
        parentOrganization: { "@type": "Organization", name: EMPRESA.nombre, url: EMPRESA.web },
        logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon`, width: 180, height: 180 },
        areaServed: { "@type": "Country", name: "Colombia" },
        contactPoint: { "@type": "ContactPoint", telephone: `+${SALES_WHATSAPP}`, contactType: "sales", areaServed: "CO", availableLanguage: "es" },
      },
      {
        "@type": "WebSite",
        "@id": id("sitio"),
        url: `${SITE_URL}/`,
        name: PLATFORM_NAME,
        inLanguage: "es-CO",
        publisher: { "@id": id("organizacion") },
      },
      {
        "@type": "WebPage",
        "@id": id("pagina"),
        url: `${SITE_URL}/`,
        name: `${PLATFORM_NAME} · Tarjeta de fidelización digital para tu negocio`,
        inLanguage: "es-CO",
        dateModified: "2026-11-11",
        isPartOf: { "@id": id("sitio") },
        about: { "@id": id("aplicacion") },
        primaryImageOfPage: `${SITE_URL}/opengraph-image`,
      },
      {
        "@type": "SoftwareApplication",
        "@id": id("aplicacion"),
        name: `${PLATFORM_NAME}: tarjeta de sellos digital`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Android, iOS (navegador web)",
        url: `${SITE_URL}/`,
        inLanguage: "es-CO",
        image: `${SITE_URL}/opengraph-image`,
        description: descripcion,
        publisher: { "@id": id("organizacion") },
        offers: [
          plan("Starter", 79990, "Para un local que empieza: 100 clientes, 2 personas del equipo y 1 sede. Primer mes gratis."),
          plan("Pro", 139990, "Para el negocio que ya tiene movimiento: 300 clientes, 10 personas del equipo y 3 sedes."),
        ],
      },
      {
        "@type": "FAQPage",
        "@id": id("preguntas"),
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}

export default function Home() {
  return (
    <div className={`${fuenteTitulos.variable} ${fuenteTexto.variable} bg-white font-[family-name:var(--font-text)] text-coal [&_h1]:text-balance [&_p]:text-pretty`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados()).replace(/</g, "\\u003c") }} />
      <EncabezadoSitio enPortada />

      {/* Portada */}
      <div className="on-cobalt overflow-x-clip bg-cobalt text-white">

        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-16 lg:pt-6">
          <div>
            <h1 className={`${poster} text-[3.6rem] leading-[0.95] sm:text-8xl lg:text-[6.5rem]`}>
              <span className="mb-5 block font-[family-name:var(--font-text)] text-lg font-semibold tracking-normal text-white/85 sm:text-xl">Tarjeta de sellos digital para tu negocio</span>
              Haz que tus clientes <span className="text-sun">vuelvan.</span>
            </h1>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/90">
              Lazo es la tarjeta de fidelización digital de tu negocio: con tu marca, en el celular de cada cliente. Y un panel que te dice quién volvió, quién dejó de venir y a quién avisarle hoy.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <WhatsAppButton className="bg-sun text-coal" />
              <a href="#como-funciona" className={`${btn} border-2 border-white/60 text-white`}>Ver cómo funciona</a>
            </div>
            <p className="mt-5 text-[15px] text-white/80">Tu cliente se inscribe con un QR, guarda la tarjeta en Google Wallet y suma sellos acercando el celular a una etiqueta NFC.</p>
          </div>
          <div className="relative isolate mx-auto">
            {/* Silueta de Nudo de fondo, detrás del celular */}
            <div aria-hidden className="nudo-silueta pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[165%] max-w-none -translate-x-1/2 -translate-y-1/2">
              <NudoDibujo />
            </div>
            <WalletPhone />
            <p className={`${poster} absolute -right-2 top-[70%] flex size-28 lg:-right-12 rotate-12 items-center justify-center rounded-full bg-sun p-3 text-center text-[17px] leading-[1.05] text-coal shadow-[0_14px_28px_-12px_rgb(6_10_36/0.6)] sm:size-36 sm:text-2xl`}>
              Starter: primer mes gratis
            </p>
          </div>
        </section>
      </div>
      <Punch bg="#1b3fd8" hole="#ffffff" />

      <main>
        {/* El problema */}
        <section className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
          <p className={`${poster} max-w-5xl text-4xl leading-[1.08] sm:text-6xl`}>
            La tarjeta de cartón se pierde. La memoria no alcanza. <span className="text-cobalt">Y el cliente que no vuelve no te avisa.</span>
          </p>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-graphite">
            Vendes todos los días, pero al cerrar no sabes quién es tu cliente fiel ni quién se fue a la competencia. Eso es lo que resolvemos.
          </p>
        </section>
        <EscenaCliente />

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-28 bg-sun lg:scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24">
            <h2 className={`${h2} reveal`}>Cómo funciona la tarjeta de sellos digital</h2>
            <ol className="mt-12 divide-y-2 divide-coal border-y-2 border-coal">
              {[
                ["Escanea el QR una sola vez", "Lo pones en la caja. Tu cliente escribe su nombre y su celular y ya tiene su tarjeta. No descarga nada."],
                ["La guarda en Google Wallet", "En Android queda en la billetera de su celular, siempre a la mano. En iPhone la abre desde su enlace, sin instalar nada."],
                ["Acerca el celular a la etiqueta y se marca el sello", "Pegas una etiqueta NFC en el mostrador. El sello queda guardado con fecha y hora y, al completar los sellos, el premio aparece solo en su tarjeta."],
              ].map(([t, d], i) => (
                <li key={t} className="reveal grid gap-2 py-7 md:grid-cols-[6rem_1fr_1.2fr] md:items-baseline md:gap-6">
                  <span className={`${poster} text-5xl`}>{i + 1}</span>
                  <h3 className={`${poster} text-2xl sm:text-3xl`}>{t}</h3>
                  <p className="text-lg leading-relaxed">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Beneficios */}
        <section className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
          <h2 className={`${h2} max-w-4xl`}>Todo lo que hoy no sabes de tus clientes</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-6">
            <div className="rounded-xl bg-sun p-7 sm:p-12 lg:col-span-4 lg:row-span-1">
              <h3 className={`${poster} text-3xl sm:text-5xl sm:leading-[1.02]`}>A quién avisarle, y el aviso ya listo</h3>
              <p className="mt-4 max-w-xl text-lg leading-relaxed">
                Te mostramos a quién le falta poco para el premio, quién cumple años este mes y quién no viene hace tiempo. Con un botón, el aviso le llega al celular como una notificación, con su nombre. Solo a quienes aceptaron recibir mensajes.
              </p>
              <div className="mt-7 flex max-w-md items-start gap-3 rounded-2xl border-2 border-coal bg-white p-4">
                <span aria-hidden className={`${poster} flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt text-lg text-white`}>E</span>
                <div className="min-w-0 text-[15px] leading-snug">
                  <p className="flex justify-between gap-2 text-sm text-graphite">
                    <span>Estudio Lila</span>
                    <span>ahora</span>
                  </p>
                  <p className="mt-0.5 font-semibold">¡Ya casi tienes tu premio!</p>
                  <p>Hola Laura, estás a muy poco de tu premio. ¡Te esperamos!</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-cobalt p-7 text-white sm:p-10 lg:col-span-2">
              <h3 className={`${poster} text-3xl`}>Cada cliente, con su historia</h3>
              <dl className="mt-7 space-y-4">
                {[["Laura Gómez", "cliente desde marzo"], ["14", "visitas"], ["8 de 10", "sellos"], ["Hace 4 días", "su última visita"]].map(([v, l]) => (
                  <div key={l} className="border-b border-white/20 pb-3">
                    <dd className="text-xl font-semibold">{v}</dd>
                    <dt className="text-sm text-white/85">{l}</dt>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl bg-cobalt p-7 text-white sm:p-10 lg:col-span-2">
              <h3 className={`${poster} text-3xl`}>¿Martes flojo?</h3>
              <p className="mt-3 text-lg leading-relaxed text-white/90">Doble sello los martes. La creas una vez y se aplica sola.</p>
            </div>
            <div className="rounded-xl border-2 border-coal p-7 sm:p-10 lg:col-span-4">
              <h3 className={`${poster} text-3xl`}>Tu negocio en números</h3>
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["89%", "de tus clientes vuelven"],
                  ["65", "visitas en 30 días"],
                  ["Sábado", "tu día más fuerte"],
                  ["12", "premios canjeados"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-lg bg-[#eef1fd] p-4">
                    <dd className={`${poster} tabular text-3xl text-cobalt`}>{v}</dd>
                    <dt className="mt-1 text-[15px] leading-snug text-graphite">{l}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-graphite">Ejemplo con datos ficticios.</p>
            </div>
          </div>
        </section>

        {/* Marca */}
        <section className="overflow-x-clip bg-[#eef1fd] pb-16 lg:pb-20">
          <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-8 lg:pt-24">
            <h2 className={`${h2} max-w-3xl`}>Con tu marca, no con la nuestra</h2>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-graphite">
              Tu logo, tus colores, tu sello, tu letra y el nombre de tu club. Así se ven algunas tarjetas de ejemplo en la misma plataforma.
            </p>
          </div>
          <BrandPreview />
        </section>

        {/* NFC */}
        <section className="on-cobalt bg-cobalt text-white">
          <div className="reveal mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
            <div>
              <h2 className={`${h2} max-w-4xl`}>
                Sellos con NFC: <span className="text-sun">acerca el celular y listo.</span>
              </h2>
              <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/90">
                Pegas una etiqueta NFC en tu mostrador y la activas desde tu panel. Tu cliente acerca el celular y el sello se marca solo, con fecha y hora. No necesitas lector ni datáfono.
              </p>
              <p className="mt-4 max-w-3xl text-lg text-white/85">El QR solo sirve la primera vez, para crear la tarjeta. Después, todo es acercar el celular.</p>
            </div>
            <NfcAnimacion />
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="reveal mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-8 lg:scroll-mt-20 lg:py-28">
          <h2 className={h2}>Planes y precios</h2>
          <p className="mt-4 text-xl text-graphite">Precios en pesos colombianos, con IVA incluido. Pago mensual, sin permanencia. Todos incluyen la tarjeta con tu marca, avisos al celular de tus clientes, promociones, premios y estadísticas.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3 md:items-stretch">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col rounded-xl p-8 ${
                  p.featured ? "bg-coal text-white shadow-[0_24px_40px_-24px_rgb(14_26_82/0.7)]" : "border-2 border-coal/15"
                }`}
              >
                {/* Borde perforado de tarjeta de sellos */}
                <div
                  aria-hidden
                  className="mb-6 h-3"
                  style={{
                    backgroundImage: `radial-gradient(circle, ${p.featured ? "rgb(255 255 255 / 0.28)" : "rgb(14 26 82 / 0.18)"} 4px, transparent 4.5px)`,
                    backgroundSize: "20px 12px",
                    backgroundRepeat: "repeat-x",
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`${poster} text-4xl`}>{p.name}</h3>
                  <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${p.freeMonth ? "bg-sun text-coal" : p.featured ? "bg-white/15 text-white" : "invisible"}`}>
                    {p.chip}
                  </span>
                </div>
                <p className="mt-2 min-h-12 text-[15px]">{p.who}</p>
                <ul className="mt-4 space-y-2 text-lg font-medium">
                  {p.lines.map((l) => <li key={l}>{l}</li>)}
                </ul>
                <div className="mt-auto pt-8">
                  <p className="flex items-baseline gap-2 text-lg">
                    <strong className={`${poster} whitespace-nowrap text-4xl ${p.featured ? "text-sun" : ""}`}>{p.price}</strong>
                    <span className="min-h-7">{p.custom ? "" : "al mes"}</span>
                  </p>
                  <a
                    href={p.freeMonth ? whatsappHref : whatsappLink(`Hola, quiero saber más del plan ${p.name} de ${PLATFORM_NAME}.`)}
                    target="_blank"
                    rel="noopener"
                    className={`mt-5 flex h-12 items-center justify-center rounded-lg px-4 font-semibold transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97] ${
                      p.featured ? "bg-sun text-coal" : "border-2 border-coal text-coal"
                    }`}
                  >
                    {p.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="scroll-mt-28 border-t-2 border-coal/10 lg:scroll-mt-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
            <h2 className={h2}>Preguntas sobre la tarjeta de fidelización digital</h2>
            <div className="divide-y-2 divide-coal/10 border-y-2 border-coal/10">
              {FAQ.map((f) => (
                <details key={f.q} className="faq group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-2xl leading-none text-cobalt transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-[17px] leading-relaxed text-graphite">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        {/* Guías y páginas por tipo de negocio */}
        <section className="border-t-2 border-coal/10 bg-[#eef1fd]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24">
            <h2 className={h2}>Aprende antes de decidir</h2>
            <p className="mt-4 max-w-2xl text-xl text-graphite">Guías cortas sobre tarjetas de fidelización y ejemplos para tu tipo de negocio.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PAGINAS.filter((p) => p.tipo !== "legal").map((p) => (
                <li key={p.ruta}>
                  <Link href={`/${p.ruta}`} className="group flex h-full flex-col justify-between gap-6 rounded-xl border-2 border-coal/10 bg-white p-6 transition-colors hover:border-cobalt">
                    <span>
                      <span className="block text-sm font-semibold text-cobalt">{p.antetitulo}</span>
                      <span className={`${poster} mt-2 block text-2xl leading-[1.1]`}>{p.h1}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 font-semibold">
                      Leer <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* Cierre */}
      <Punch bg="#1b3fd8" hole="#ffffff" />
      <section className="on-cobalt relative overflow-hidden bg-cobalt text-white">
        {/* Nudo como imagen del cierre */}
        <div aria-hidden className="pointer-events-none absolute right-2 -bottom-3 w-[210px] sm:right-8 sm:w-[240px] lg:right-[7%] lg:bottom-6 lg:w-[400px]">
          <NudoDibujo />
        </div>
        <div className="reveal relative mx-auto max-w-7xl px-4 pt-24 pb-60 sm:px-8 lg:py-36">
          <h2 className={`${poster} max-w-4xl text-5xl leading-[0.98] sm:text-8xl`}>¿Hablamos de <span className="text-sun">tu negocio?</span></h2>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-white/90">Escríbenos y te dejamos la tarjeta lista con tu logo.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <WhatsAppButton className="bg-sun text-coal" />
            <a href="#planes" className={`${btn} border-2 border-white/60 text-white`}>Ver los planes</a>
          </div>
        </div>
      </section>

      <PieSitio />
      <Mascota />
    </div>
  );
}
