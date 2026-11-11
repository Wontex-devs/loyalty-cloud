import type { Metadata } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import Link from "next/link";
import { LogIn, MessageCircle } from "lucide-react";
import { BrandPreview } from "@/components/marketing/brand-preview";
import { LazoLogo } from "@/components/brand/lazo-logo";
import { EscenaCliente } from "@/components/marketing/escena-cliente";
import { Mascota, NudoDibujo } from "@/components/marketing/mascota";
import { NfcAnimacion } from "@/components/marketing/nfc-animacion";
import { WalletPhone } from "@/components/marketing/wallet-phone";
import { PLATFORM_NAME, SALES_WHATSAPP } from "@/lib/config";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-poster" });
const text = Onest({ subsets: ["latin"], variable: "--font-text" });

export const metadata: Metadata = {
  title: { absolute: `${PLATFORM_NAME} · Tarjeta de fidelización digital para tu negocio` },
  description: "Una tarjeta de sellos digital con tu marca y un panel que te dice quién vuelve y a quién escribirle. Plan Starter con primer mes gratis.",
  // Su dominio propio es la dirección principal en buscadores.
  robots: { index: true, follow: true },
  alternates: process.env.NEXT_PUBLIC_APP_URL ? { canonical: process.env.NEXT_PUBLIC_APP_URL } : undefined,
};

const whatsappLink = (text: string) => `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
const whatsappHref = whatsappLink(`Hola, quiero mi primer mes gratis del plan Starter de ${PLATFORM_NAME}.`);

const poster = "font-[family-name:var(--font-poster)] font-extrabold tracking-[-0.02em]";
const h2 = `${poster} text-balance text-4xl leading-[1.02] sm:text-6xl`;
const btn = "inline-flex h-14 items-center justify-center gap-2.5 rounded-lg px-6 text-base font-semibold transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]";

const PLANS = [
  { name: "Starter", who: "Para un local que empieza", lines: ["100 clientes", "2 personas del equipo", "1 sede"], price: "$79.990", chip: "Primer mes gratis", cta: "Quiero mi primer mes gratis", freeMonth: true },
  { name: "Pro", who: "Para el negocio que ya tiene movimiento", lines: ["300 clientes", "10 personas del equipo", "3 sedes"], price: "$139.990", chip: "Recomendado", cta: "Quiero este plan", featured: true },
  { name: "Business", who: "Para cadenas y varias sedes", lines: ["Clientes a tu medida", "Equipo a tu medida", "Sedes a tu medida"], price: "A medida", cta: "Hablemos de tu negocio", custom: true },
];

const FAQ = [
  { q: "¿Cómo funciona el primer mes gratis?", a: "Aplica al plan Starter. Te dejamos la tarjeta lista con tu marca y la usas un mes sin pagar. Si decides seguir, pagas $79.990 al mes." },
  { q: "¿Mis clientes tienen que descargar algo?", a: "No. La tarjeta se abre en el navegador del celular y se puede añadir a la pantalla de inicio como si fuera una app." },
  { q: "¿Necesito comprar algún equipo?", a: "Para marcar los sellos con NFC necesitas un lector en el mostrador. El QR solo se usa una vez, para que tu cliente cree su tarjeta; lo pones en un cartel en la caja." },
  { q: "¿Qué pasa si mi cliente cambia de celular?", a: "Vuelve a escanear el QR de tu negocio con el mismo nombre y celular, y recupera su tarjeta con todos sus sellos." },
  { q: "¿Sirve para mi tipo de negocio?", a: "Sirve para cualquier negocio con clientes que repiten: barberías, salones, cafeterías, panaderías, spas, gimnasios, lavaderos, tiendas y más." },
  { q: "¿Se pueden hacer trampas con los sellos?", a: "Solo tu equipo puede sellar, cada persona con su usuario. El sistema evita sellos repetidos por error y guarda quién registró cada visita." },
  { q: "¿Quién ve los datos de mis clientes?", a: "Solo tu negocio. Tus clientes aceptan la política de datos (Ley 1581) al inscribirse, pueden dejar de recibir mensajes desde su tarjeta y pedirte que borres sus datos." },
  { q: "¿Funciona con varias sedes?", a: "Sí. Según el plan puedes tener varias sedes y comparar sus visitas." },
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

export default function Home() {
  return (
    <div className={`${display.variable} ${text.variable} bg-white font-[family-name:var(--font-text)] text-coal [&_h1]:text-balance [&_p]:text-pretty`}>
      {/* Encabezado fijo: el acceso de los clientes siempre queda a la vista */}
      <header className="on-cobalt sticky top-0 z-40 bg-cobalt text-white shadow-[0_10px_24px_-18px_rgb(6_10_36/0.8)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-8">
          <Link href="/" aria-label={PLATFORM_NAME} className="whitespace-nowrap">
            <LazoLogo animar className="text-[32px]" markClassName="text-sun" />
          </Link>
          <nav className="flex items-center gap-4 text-[15px] font-medium sm:gap-5" aria-label="Principal">
            <a href="#como-funciona" className="hidden hover:underline lg:block">Cómo funciona</a>
            <a href="#planes" className="hidden hover:underline lg:block">Planes</a>
            <a href="#preguntas" className="hidden hover:underline lg:block">Preguntas</a>
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
            <a href="#como-funciona" className="flex h-11 items-center px-3 hover:underline">Cómo funciona</a>
            <a href="#planes" className="flex h-11 items-center px-3 hover:underline">Planes</a>
            <a href="#preguntas" className="flex h-11 items-center px-3 hover:underline">Preguntas</a>
          </div>
        </nav>
      </header>

      {/* Portada */}
      <div className="on-cobalt overflow-x-clip bg-cobalt text-white">

        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-16 lg:pt-6">
          <div>
            <h1 className={`${poster} text-[3.6rem] leading-[0.95] sm:text-8xl lg:text-[6.5rem]`}>
              Haz que tus clientes <span className="text-sun">vuelvan.</span>
            </h1>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/90">
              La tarjeta de sellos de tu negocio, ahora en el celular de cada cliente. Y un panel que te dice quién volvió, quién dejó de venir y a quién avisarle hoy.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <WhatsAppButton className="bg-sun text-coal" />
              <a href="#como-funciona" className={`${btn} border-2 border-white/60 text-white`}>Ver cómo funciona</a>
            </div>
            <p className="mt-5 text-[15px] text-white/80">Tu cliente se inscribe con un QR, guarda la tarjeta en su Wallet y suma sellos con NFC.</p>
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
            <h2 className={`${h2} reveal`}>Así funciona en tu mostrador</h2>
            <ol className="mt-12 divide-y-2 divide-coal border-y-2 border-coal">
              {[
                ["Escanea el QR una sola vez", "Lo pones en la caja. Tu cliente escribe su nombre y su celular y ya tiene su tarjeta. No descarga nada."],
                ["La guarda en su Wallet", "La tarjeta queda en la billetera de su celular, siempre a la mano."],
                ["Acerca el celular y se marca el sello", "Con NFC el sello queda guardado con fecha y hora. Al completar los sellos, el premio aparece solo en su tarjeta."],
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
              <p className="mt-4 text-sm text-graphite">Ejemplo con datos ficticios. También ves las visitas por empleado y por sede.</p>
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
                Con NFC: <span className="text-sun">acerca el celular y listo.</span>
              </h2>
              <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/90">
                Tu cliente acerca el celular al lector de tu mostrador y el sello se marca solo, como cuando paga con el teléfono.
              </p>
              <p className="mt-4 max-w-3xl text-lg text-white/85">El QR solo sirve la primera vez, para crear la tarjeta. Después, todo es acercar el celular.</p>
            </div>
            <NfcAnimacion />
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="reveal mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-8 lg:scroll-mt-20 lg:py-28">
          <h2 className={h2}>Planes</h2>
          <p className="mt-4 text-xl text-graphite">Todos incluyen la tarjeta con tu marca, avisos al celular de tus clientes, promociones, premios y estadísticas.</p>
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
            <h2 className={h2}>Lo que siempre nos preguntan</h2>
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

      <footer className="bg-sun text-coal">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 text-[15px] sm:flex-row sm:justify-between sm:px-8">
          <p>{PLATFORM_NAME} · Fidelización digital para negocios</p>
          <p>
            WhatsApp 313 893 9222 · <a href="https://wontex-devs.com" className="underline underline-offset-2">wontex-devs.com</a>
          </p>
        </div>
      </footer>
      <Mascota />
    </div>
  );
}
