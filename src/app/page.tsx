import type { Metadata } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BrandPreview } from "@/components/marketing/brand-preview";
import { WalletPhone } from "@/components/marketing/wallet-phone";
import { DEMO_URL, PLATFORM_NAME, SALES_WHATSAPP } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-poster" });
const text = Onest({ subsets: ["latin"], variable: "--font-text" });

export const metadata: Metadata = {
  title: { absolute: `${PLATFORM_NAME} · Tarjeta de fidelización digital para tu negocio` },
  description: "Una tarjeta de sellos digital con tu marca y un panel que te dice quién vuelve y a quién escribirle. Tu primer mes es gratis.",
};

const demoHref = isSupabaseConfigured ? DEMO_URL : "/login";
const whatsappHref = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero mi primer mes gratis de ${PLATFORM_NAME} para mi negocio.`)}`;

const poster = "font-[family-name:var(--font-poster)] font-extrabold tracking-[-0.02em]";
const h2 = `${poster} text-4xl leading-[1.02] sm:text-6xl`;
const btn = "inline-flex h-14 items-center justify-center gap-2.5 rounded-lg px-6 text-base font-semibold transition-transform hover:-translate-y-0.5";

const PLANS = [
  { name: "Starter", who: "Para un local con poco equipo", lines: ["300 clientes", "2 personas del equipo", "1 sede"] },
  { name: "Pro", who: "Para el negocio que ya tiene movimiento", lines: ["2.000 clientes", "10 personas del equipo", "3 sedes"], featured: true },
  { name: "Business", who: "Para cadenas y varias sedes", lines: ["Clientes sin límite", "Equipo sin límite", "Sedes sin límite"] },
];

const FAQ = [
  { q: "¿Cómo funciona el primer mes gratis?", a: "Te dejamos la tarjeta lista con tu marca y la usas un mes sin pagar. Si decides seguir, eliges el plan que te sirva." },
  { q: "¿Mis clientes tienen que descargar algo?", a: "No. La tarjeta se abre en el navegador del celular y se puede añadir a la pantalla de inicio como si fuera una app." },
  { q: "¿Necesito comprar algún equipo?", a: "No. Tu equipo registra las visitas escaneando el QR con la cámara de un celular, una tablet o un computador." },
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
    <div className={`${display.variable} ${text.variable} bg-white font-[family-name:var(--font-text)] text-coal`}>
      {/* Portada */}
      <div className="overflow-x-clip bg-cobalt text-white">
        <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className={`${poster} text-2xl`}>
            {PLATFORM_NAME}
          </Link>
          <nav className="flex items-center gap-6 text-[15px] font-medium" aria-label="Principal">
            <a href="#como-funciona" className="hidden hover:underline md:block">Cómo funciona</a>
            <a href="#planes" className="hidden hover:underline md:block">Planes</a>
            <a href="#preguntas" className="hidden hover:underline md:block">Preguntas</a>
            <Link href="/login" className="hover:underline">Entrar</Link>
          </nav>
        </header>

        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28 lg:pt-14">
          <div>
            <h1 className={`${poster} text-[3.6rem] leading-[0.95] sm:text-8xl lg:text-[6.5rem]`}>
              Haz que tus clientes <span className="text-sun">vuelvan.</span>
            </h1>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/90">
              La tarjeta de sellos de tu negocio, ahora en el celular de cada cliente. Y un panel que te dice quién volvió, quién dejó de venir y a quién escribirle hoy.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <WhatsAppButton className="bg-sun text-coal" />
              <a href={demoHref} className={`${btn} border-2 border-white/60 text-white`}>Ver la demo</a>
            </div>
          </div>
          <div className="relative">
            <WalletPhone />
            <p className={`${poster} absolute right-1 top-4 flex size-28 rotate-12 items-center justify-center rounded-full bg-sun p-3 text-center text-[17px] leading-[1.05] text-coal sm:size-32 sm:text-xl`}>
              Primer mes gratis
            </p>
            <p className="text-center text-sm text-white/80">Así se verá en Wallet. Muy pronto.</p>
          </div>
        </section>
      </div>
      <Punch bg="#1b3fd8" hole="#ffffff" />

      <main>
        {/* El problema */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
          <p className={`${poster} max-w-5xl text-4xl leading-[1.08] sm:text-6xl`}>
            La tarjeta de cartón se pierde. La memoria no alcanza. <span className="text-cobalt">Y el cliente que no vuelve no te avisa.</span>
          </p>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-graphite">
            Vendes todos los días, pero al cerrar no sabes quién es tu cliente fiel ni quién se fue a la competencia. Eso es lo que resolvemos.
          </p>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-4 bg-sun">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24">
            <h2 className={h2}>Así funciona en tu mostrador</h2>
            <ol className="mt-12 divide-y-2 divide-coal border-y-2 border-coal">
              {[
                ["Tu cliente escanea el QR", "Lo pones en la caja. Escribe su nombre y su celular y ya tiene su tarjeta. No descarga nada."],
                ["Tu equipo le pone el sello", "Escanean su código con cualquier celular. Queda guardado con fecha y hora."],
                ["Vuelve por su premio", "Al completar los sellos, el premio aparece solo en su tarjeta."],
              ].map(([t, d], i) => (
                <li key={t} className="grid gap-2 py-7 md:grid-cols-[6rem_1fr_1.2fr] md:items-baseline md:gap-6">
                  <span className={`${poster} text-5xl`}>{i + 1}</span>
                  <h3 className={`${poster} text-2xl sm:text-3xl`}>{t}</h3>
                  <p className="text-lg leading-relaxed">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Beneficios */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
          <h2 className={`${h2} max-w-4xl`}>Todo lo que hoy no sabes de tus clientes</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-6">
            <div className="rounded-xl bg-sun p-7 sm:p-10 lg:col-span-4">
              <h3 className={`${poster} text-3xl sm:text-4xl`}>A quién escribirle, y el mensaje ya listo</h3>
              <p className="mt-3 max-w-xl text-lg leading-relaxed">
                Te mostramos a quién le falta poco para el premio, quién cumple años este mes y quién no viene hace tiempo. Tocas un botón y sale por tu WhatsApp, con su nombre.
              </p>
              <p className="mt-7 max-w-md rounded-xl rounded-tl-none bg-white p-5 text-[17px] leading-relaxed">
                Hola Laura, ¡solo te falta 1 visita para tu manicura gratis en Estudio Lila! Te esperamos.
              </p>
            </div>
            <div className="rounded-xl bg-cobalt p-7 text-white sm:p-10 lg:col-span-2">
              <h3 className={`${poster} text-3xl`}>Cada cliente, con su historia</h3>
              <dl className="mt-7 space-y-4">
                {[["Laura Gómez", "cliente desde marzo"], ["14", "visitas"], ["8 de 10", "sellos"], ["Hace 4 días", "su última visita"]].map(([v, l]) => (
                  <div key={l} className="border-b border-white/20 pb-3">
                    <dd className="text-xl font-semibold">{v}</dd>
                    <dt className="text-sm text-white/70">{l}</dt>
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
              <ul className="mt-5 grid gap-x-8 gap-y-2 text-lg sm:grid-cols-2">
                <li>Cuántos clientes vuelven</li>
                <li>Tus días y horas fuertes</li>
                <li>Premios ganados y canjeados</li>
                <li>Visitas por empleado y por sede</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Marca */}
        <section className="bg-[#eef1fd]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className={h2}>Con tu marca, no con la nuestra</h2>
              <p className="mt-6 max-w-lg text-xl leading-relaxed text-graphite">
                Tu logo, tus colores, tu sello y tu letra. Toca un negocio y mira cómo cambia la tarjeta.
              </p>
            </div>
            <BrandPreview />
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="mx-auto max-w-7xl scroll-mt-4 px-4 py-20 sm:px-8 lg:py-28">
          <h2 className={h2}>Planes</h2>
          <p className="mt-4 text-xl text-graphite"><strong className="text-coal">El primer mes te lo regalamos.</strong> Todos incluyen la tarjeta con tu marca, mensajes por WhatsApp, promociones, premios y estadísticas.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={p.featured ? "rounded-xl bg-sun p-8" : "rounded-xl border-2 border-coal/15 p-8"}>
                <h3 className={`${poster} text-4xl`}>{p.name}</h3>
                <p className="mt-2 text-[15px]">{p.who}</p>
                <ul className="mt-6 space-y-2 text-lg font-medium">
                  {p.lines.map((l) => <li key={l}>{l}</li>)}
                </ul>
                <a href={whatsappHref} target="_blank" rel="noopener" className="mt-7 inline-block font-semibold underline underline-offset-4">Pregunta el precio</a>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-graphite">
            <strong className="text-coal">Lo que viene:</strong> estamos preparando tu tarjeta en Google Wallet y Apple Wallet, con avisos al celular. Si empiezas hoy, pasas sin perder clientes ni sellos.
          </p>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="scroll-mt-4 border-t-2 border-coal/10">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
            <h2 className={h2}>Lo que siempre nos preguntan</h2>
            <div className="divide-y-2 divide-coal/10 border-y-2 border-coal/10">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
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
      <section className="bg-cobalt text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
          <h2 className={`${poster} max-w-4xl text-5xl leading-[0.98] sm:text-8xl`}>¿Hablamos de tu negocio?</h2>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-white/90">Escríbenos, te dejamos la tarjeta lista con tu logo y el primer mes te lo regalamos.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <WhatsAppButton className="bg-sun text-coal" />
            <a href={demoHref} className={`${btn} border-2 border-white/60 text-white`}>Ver la demo</a>
          </div>
        </div>
      </section>

      <footer className="bg-sun text-coal">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 text-[15px] sm:flex-row sm:justify-between sm:px-8">
          <p>{PLATFORM_NAME} · by Wontex</p>
          <p>
            WhatsApp 313 893 9222 · <a href="https://wontex-devs.com" className="underline underline-offset-2">wontex-devs.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
