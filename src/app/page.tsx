import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarHeart, Check, Clock, Gift, MessageCircle, QrCode, ShieldCheck, Smartphone, Stamp, Users } from "lucide-react";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card";
import { BrandPreview } from "@/components/marketing/brand-preview";
import { DEMO_URL, PLATFORM_NAME, SALES_WHATSAPP } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: { absolute: `${PLATFORM_NAME} · Tarjeta de fidelización digital para tu negocio` },
  description: "Una tarjeta de sellos digital con tu marca y un panel que te dice quién vuelve, quién dejó de venir y a quién escribirle.",
};

const demoHref = isSupabaseConfigured ? DEMO_URL : "/login";
const whatsappHref = SALES_WHATSAPP
  ? `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero saber más sobre ${PLATFORM_NAME} para mi negocio.`)}`
  : null;

const primaryBtn = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-night px-6 text-[15px] font-medium text-cream transition-opacity hover:opacity-85";
const secondaryBtn = "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-night/20 px-6 text-[15px] font-medium text-night transition-colors hover:border-night/50";
const eyebrow = "text-xs font-semibold uppercase tracking-[0.2em] text-rose";
const heading = "font-serif text-4xl font-semibold leading-[1.08] text-night sm:text-5xl";

const STEPS = [
  { icon: QrCode, title: "Se inscribe en segundos", text: "Escanea el QR de tu mostrador y escribe su nombre y su celular. No descarga nada." },
  { icon: Stamp, title: "Suma un sello en cada visita", text: "Tu equipo escanea el código de su tarjeta con cualquier celular. Queda registrado con fecha y hora." },
  { icon: Gift, title: "Vuelve por su premio", text: "Al completar los sellos, la recompensa aparece sola en su tarjeta y la canjea contigo." },
];

const GROUPS = ["Cerca del premio", "Cumpleaños del mes", "Hace tiempo no vienen", "Premio sin canjear", "Nuevos"];

const STATS = [
  { icon: Users, title: "Cuántos clientes vuelven", text: "Activos, nuevos y los que ya repiten." },
  { icon: Clock, title: "Tus días y horas fuertes", text: "Para saber cuándo te conviene una promoción." },
  { icon: Gift, title: "Premios ganados y canjeados", text: "Cuántos entregaste y cuántos siguen esperando." },
  { icon: BarChart3, title: "Tu equipo y tus sedes", text: "Visitas registradas por empleado y por sede." },
];

const PLANS = [
  { name: "Starter", lines: ["Hasta 300 clientes", "2 personas del equipo", "1 sede"] },
  { name: "Pro", lines: ["Hasta 2.000 clientes", "10 personas del equipo", "3 sedes"], featured: true },
  { name: "Business", lines: ["Clientes sin límite", "Equipo sin límite", "Sedes sin límite"] },
];

const FAQ = [
  { q: "¿Mis clientes tienen que descargar algo?", a: "No. La tarjeta se abre en el navegador del celular y se puede añadir a la pantalla de inicio como si fuera una app." },
  { q: "¿Necesito comprar algún equipo?", a: "No. Tu equipo registra las visitas escaneando el QR con la cámara de un celular, una tablet o un computador." },
  { q: "¿Qué pasa si mi cliente cambia de celular?", a: "Vuelve a escanear el QR de tu negocio con el mismo nombre y celular, y recupera su tarjeta con todos sus sellos." },
  { q: "¿Sirve para mi tipo de negocio?", a: "Sirve para cualquier negocio con clientes que repiten: barberías, salones, cafeterías, panaderías, spas, gimnasios, lavaderos, tiendas y más." },
  { q: "¿Se pueden hacer trampas con los sellos?", a: "Solo tu equipo puede sellar, cada persona con su usuario. El sistema evita sellos repetidos por error y guarda quién registró cada visita." },
  { q: "¿Quién ve los datos de mis clientes?", a: "Solo tu negocio. Tus clientes aceptan la política de datos (Ley 1581) al inscribirse, pueden dejar de recibir mensajes desde su tarjeta y pedirte que borres sus datos." },
  { q: "¿Funciona con varias sedes?", a: "Sí. Según el plan puedes tener varias sedes y comparar sus visitas." },
];

function Actions({ dark }: { dark?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a href={demoHref} className={dark ? `${primaryBtn} bg-cream text-night` : primaryBtn}>
        Ver la demo <ArrowRight className="size-4" />
      </a>
      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener" className={dark ? `${secondaryBtn} border-cream/30 text-cream hover:border-cream/60` : secondaryBtn}>
          <MessageCircle className="size-4" /> Escríbenos por WhatsApp
        </a>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-cream text-night">
      <header className="sticky top-0 z-40 border-b border-night/5 bg-cream/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Principal">
          <Link href="/" className="font-serif text-xl font-semibold">
            {PLATFORM_NAME}
          </Link>
          <div className="hidden items-center gap-7 text-sm text-plum md:flex">
            <a href="#como-funciona" className="hover:text-night">Cómo funciona</a>
            <a href="#beneficios" className="hover:text-night">Beneficios</a>
            <a href="#planes" className="hover:text-night">Planes</a>
            <a href="#preguntas" className="hover:text-night">Preguntas</a>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-plum hover:text-night">Entrar</Link>
            <a href={demoHref} className="inline-flex h-9 items-center rounded-full bg-night px-4 font-medium text-cream">Ver la demo</a>
          </div>
        </nav>
      </header>

      <main>
        {/* Portada */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className={eyebrow}>Fidelización digital para negocios locales</p>
            <h1 className="mt-5 font-serif text-5xl font-semibold leading-[1.02] sm:text-7xl">Haz que tus clientes vuelvan.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-plum">
              Una tarjeta de sellos con tu marca en el celular de cada cliente, y un panel que te dice quién vuelve, quién dejó de venir y a quién escribirle hoy.
            </p>
            <div className="mt-8">
              <Actions />
            </div>
            <ul className="mt-8 flex flex-col gap-2 text-sm text-plum sm:flex-row sm:gap-6">
              {["Sin aplicaciones", "Sin equipos especiales", "Con tu logo y tus colores"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-rose" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <LoyaltyCardView
              business={{
                name: "Barbería Norte",
                branding: { logoText: "BN", cardBackground: "#1C2333", cardForeground: "#E8DCC4", primary: "#E8DCC4", primaryForeground: "#1C2333", accent: "#C9B48A", stampIcon: "scissors", font: "sans" },
              }}
              program={{ name: "Barbería Norte", stampsRequired: 6, rewardName: "Corte gratis" }}
              customerName="Andrés Ruiz"
              stamps={5}
              status="active"
              rewardsAvailable={0}
            />
            <p className="mt-3 text-center text-xs text-plum">Ejemplo con un negocio inventado</p>
          </div>
        </section>

        {/* El problema */}
        <section className="bg-night text-cream">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
            <h2 className="font-serif text-4xl font-semibold leading-[1.08] sm:text-5xl">Cada cliente que no vuelve se va sin avisarte.</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                ["El cartón se pierde", "Y con él se van los sellos y la razón para volver."],
                ["La memoria no alcanza", "Nadie puede recordar quién dejó de venir hace dos meses."],
                ["Escribirle a todos cansa", "Sin datos no sabes a quién escribirle, ni cuándo, ni qué decirle."],
              ].map(([t, d]) => (
                <div key={t}>
                  <h3 className="font-serif text-2xl font-semibold text-rose-soft">{t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-cream/75">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <p className={eyebrow}>Cómo funciona</p>
          <h2 className={`${heading} mt-4`}>Tres pasos, y tu cliente ya tiene un motivo para volver</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-rose/30 pt-6">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-5xl font-semibold text-rose">{i + 1}</span>
                  <s.icon className="size-6 text-plum" aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-plum">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Beneficios */}
        <section id="beneficios" className="scroll-mt-16 bg-blush">
          <div className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className={eyebrow}>Conoce a tus clientes</p>
                <h2 className={`${heading} mt-4`}>Deja de adivinar quién es tu cliente fiel</h2>
                <p className="mt-5 text-lg leading-relaxed text-plum">
                  Cada visita queda guardada. Ves cuántas veces ha venido cada persona, cuándo fue la última, qué premios ha ganado y cuánto le falta para el siguiente. Esa base de clientes es tuya.
                </p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-pop sm:p-8">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-blush font-semibold text-rose">LG</span>
                  <div>
                    <p className="text-lg font-semibold">Laura Gómez</p>
                    <p className="text-sm text-plum">Cliente desde marzo</p>
                  </div>
                </div>
                <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                  {[["14", "visitas"], ["8/10", "sellos"], ["4 días", "desde su visita"]].map(([v, l]) => (
                    <div key={l} className="rounded-2xl bg-cream px-2 py-4">
                      <dd className="text-xl font-semibold">{v}</dd>
                      <dt className="mt-1 text-xs text-plum">{l}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-center text-xs text-plum">Ficha de ejemplo</p>
              </div>
            </div>

            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="lg:order-2">
                <p className={eyebrow}>Escríbeles en el momento justo</p>
                <h2 className={`${heading} mt-4`}>Te decimos a quién escribirle, y el mensaje ya va listo</h2>
                <p className="mt-5 text-lg leading-relaxed text-plum">
                  La plataforma arma los grupos por ti. Eliges uno, tocas un botón por cliente y el mensaje sale con su nombre desde tu propio WhatsApp. Solo aparecen quienes aceptaron recibir mensajes.
                </p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {GROUPS.map((g) => (
                    <li key={g} className="rounded-full border border-night/10 bg-white px-4 py-2 text-sm font-medium">{g}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-pop sm:p-8 lg:order-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#2F6B3F]">
                  <MessageCircle className="size-4" /> WhatsApp · Laura Gómez
                </p>
                <p className="mt-4 rounded-2xl rounded-tl-sm bg-[#DFF3D6] p-5 text-[15px] leading-relaxed">
                  Hola Laura, ¡solo te falta 1 visita para tu manicura gratis en Estudio Lila! Te esperamos.
                </p>
                <p className="mt-4 text-center text-xs text-plum">Mensaje de ejemplo; tú puedes cambiarlo</p>
              </div>
            </div>

            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className={eyebrow}>Llena tus días flojos</p>
                <h2 className={`${heading} mt-4`}>¿Martes flojo? Doble sello los martes.</h2>
                <p className="mt-5 text-lg leading-relaxed text-plum">
                  Creas la promoción una vez y se aplica sola en los días que elijas. Las recompensas también: tú decides el premio, cuántos sellos hacen falta y cuándo vence.
                </p>
              </div>
              <div>
                <p className="mb-4 font-serif text-2xl font-semibold">Y ves en números qué funcionó</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STATS.map((s) => (
                    <div key={s.title} className="rounded-2xl bg-white p-5">
                      <s.icon className="size-5 text-rose" aria-hidden />
                      <h3 className="mt-3 font-semibold">{s.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-plum">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marca */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <p className={eyebrow}>Tu marca, no la nuestra</p>
          <h2 className={`${heading} mt-4`}>Una tarjeta que se siente de tu negocio</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-plum">
            Tu logo, tus colores, el icono del sello y la tipografía. Prueba cómo cambia según el negocio:
          </p>
          <div className="mt-10">
            <BrandPreview />
          </div>
        </section>

        {/* Confianza */}
        <section className="border-y border-night/5 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            {[
              { icon: Smartphone, t: "Fácil para tus clientes", d: "Sin aplicaciones ni contraseñas. Su tarjeta siempre está en el celular." },
              { icon: Users, t: "Claro para tu equipo", d: "Cada persona entra con su usuario y solo ve lo que necesita." },
              { icon: ShieldCheck, t: "Seguro para tus datos", d: "Solo tu negocio ve tu información, con tratamiento de datos según la Ley 1581." },
            ].map((x) => (
              <div key={x.t} className="flex gap-4">
                <x.icon className="mt-1 size-6 shrink-0 text-rose" aria-hidden />
                <div>
                  <h3 className="font-semibold">{x.t}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-plum">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <p className={eyebrow}>Planes</p>
          <h2 className={`${heading} mt-4`}>Un plan para cada tamaño de negocio</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={p.featured ? "rounded-3xl bg-night p-8 text-cream" : "rounded-3xl border border-night/10 bg-white p-8"}>
                <h3 className="font-serif text-3xl font-semibold">{p.name}</h3>
                <p className={p.featured ? "mt-2 text-sm text-cream/70" : "mt-2 text-sm text-plum"}>Precio a consultar</p>
                <ul className="mt-6 space-y-3 text-[15px]">
                  {p.lines.map((l) => (
                    <li key={l} className="flex items-center gap-2.5">
                      <Check className={p.featured ? "size-4 text-rose-soft" : "size-4 text-rose"} /> {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[15px] text-plum">Todos incluyen la tarjeta con tu marca, mensajes por WhatsApp, promociones, recompensas y estadísticas.</p>
        </section>

        {/* Lo que viene */}
        <section className="bg-blush">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6 md:flex-row md:items-center md:gap-10">
            <CalendarHeart className="size-9 shrink-0 text-rose" aria-hidden />
            <div>
              <h2 className="font-serif text-3xl font-semibold">Lo que viene: tu tarjeta en la billetera del celular</h2>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-plum">
                Estamos preparando Google Wallet y Apple Wallet, con avisos automáticos al celular. Quienes empiecen hoy pasan a la billetera sin perder clientes ni sellos.
              </p>
            </div>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <h2 className={heading}>Preguntas frecuentes</h2>
          <div className="mt-8 divide-y divide-night/10 border-y border-night/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl leading-none text-rose transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-plum">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Cierre */}
        <section className="bg-night text-cream">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="max-w-2xl font-serif text-5xl font-semibold leading-[1.05]">Tu próximo cliente fiel ya pasó por tu mostrador.</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream/75">Mira cómo funciona en la demo, con datos de ejemplo y sin crear una cuenta.</p>
            <div className="mt-8">
              <Actions dark />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-night text-cream/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-cream/10 px-4 py-6 text-sm sm:flex-row sm:justify-between sm:px-6">
          <p>{PLATFORM_NAME} · by Wontex</p>
          <a href="https://wontex-devs.com" className="hover:text-cream">wontex-devs.com</a>
        </div>
      </footer>
    </div>
  );
}
