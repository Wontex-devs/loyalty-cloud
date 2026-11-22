import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, MessageCircle, Smartphone, Stamp, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { EncabezadoSitio, PieSitio } from "@/components/marketing/sitio";
import { fuenteTexto, fuenteTitulos, poster } from "@/components/marketing/fuentes";
import { DEMO_SLUG, PLATFORM_NAME, SALES_WHATSAPP, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: { absolute: `Prueba ${PLATFORM_NAME} en tu celular · Demo de la tarjeta de sellos` },
  description: "Crea una tarjeta de sellos de prueba, guárdala en Apple Wallet o Google Wallet y súmate un sello para ver cómo le llega a tu cliente. Gratis y en 30 segundos.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/demo" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: PLATFORM_NAME,
    url: "/demo",
    title: "Prueba la tarjeta de sellos en tu celular",
    description: "En 30 segundos ves lo mismo que verán tus clientes: la tarjeta en tu billetera, el sello y el aviso.",
  },
};

const btn =
  "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-lg px-6 py-3 text-center text-base leading-snug font-semibold transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]";

const PASOS = [
  { icono: Smartphone, titulo: "Crea tu tarjeta", texto: "Escribe tu nombre y tu celular, como lo hará tu cliente al escanear el QR de tu negocio." },
  { icono: Wallet, titulo: "Guárdala en tu billetera", texto: "Un botón y queda en Apple Wallet (iPhone) o Google Wallet (Android). Sin descargar ninguna app." },
  { icono: Stamp, titulo: "Súmate un sello", texto: "En la tarjeta verás «Sumar un sello de prueba». Tócalo y mira cómo se llena tu tarjeta." },
  { icono: BellRing, titulo: "Mira el aviso", texto: "Con la tarjeta en tu billetera, te llega el aviso al celular: «Sello nuevo… te faltan 3». Igual que a tus clientes." },
];

/** Demo para vender: el dueño de un negocio prueba la tarjeta en su propio celular. */
export default function DemoPage() {
  const inscripcion = `/join/${DEMO_SLUG}`;
  const whatsapp = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent("Hola, probé la demo de Lazo y quiero la tarjeta para mi negocio.")}`;

  return (
    <div className={`${fuenteTitulos.variable} ${fuenteTexto.variable} bg-white font-[family-name:var(--font-text)] text-coal [&_h1]:text-balance [&_p]:text-pretty`}>
      <EncabezadoSitio />
      <main>
        <section className="on-cobalt bg-cobalt text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:py-20">
            <div>
              <p className="text-sm font-semibold tracking-wider text-sun uppercase">Demo gratis · 30 segundos</p>
              <h1 className={`${poster} mt-3 text-5xl leading-[1.02] sm:text-6xl`}>Pruébalo en tu celular, como lo verá tu cliente</h1>
              <p className="mt-5 max-w-xl text-lg text-white/85">
                Crea una tarjeta de sellos de prueba, guárdala en tu billetera y súmate un sello. Vas a sentir lo mismo que tus clientes cada vez que vuelvan a tu
                negocio.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={inscripcion} className={`${btn} bg-sun text-coal`}>
                  <Smartphone className="size-5 shrink-0" /> Crear mi tarjeta de prueba
                </Link>
                <a href={whatsapp} target="_blank" rel="noopener" className={`${btn} border-2 border-white/60 text-white`}>
                  <MessageCircle className="size-5 shrink-0" /> Hablar con nosotros
                </a>
              </div>
            </div>
            {/* En el computador: el QR abre la demo en el celular. */}
            <div className="hidden justify-center lg:flex">
              <div className="rounded-2xl bg-white p-6 text-center text-coal shadow-[0_24px_48px_-20px_rgb(6_10_36/0.6)]">
                <QRCodeSVG value={`${SITE_URL}${inscripcion}`} size={196} level="M" marginSize={0} />
                <p className="mt-4 font-semibold">Escanéalo con tu celular</p>
                <p className="text-sm text-coal/70">La demo se vive en el celular.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#eef1fd]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className={`${poster} text-4xl leading-[1.02] sm:text-5xl`}>Así funciona la demo</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="rounded-xl bg-white p-6 shadow-[0_10px_30px_-18px_rgb(6_10_36/0.35)]">
                  <div className="flex items-center gap-3">
                    <span className={`${poster} flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt text-lg text-white`}>{i + 1}</span>
                    <p.icono className="size-5 text-cobalt" />
                  </div>
                  <p className="mt-4 text-lg font-semibold">{p.titulo}</p>
                  <p className="mt-1 text-coal/75">{p.texto}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-coal/70">
              En tu negocio el sello lo pone tu equipo al escanear la tarjeta, o tu cliente al acercar el celular a la etiqueta NFC del mostrador. En la demo te lo
              sumas tú para que lo veas de una vez.
            </p>
          </div>
        </section>

        <section className="bg-sun">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-16">
            <div>
              <h2 className={`${poster} text-4xl leading-[1.02] sm:text-5xl`}>¿Te gustó? Tenla con tu marca</h2>
              <p className="mt-3 max-w-xl text-lg text-coal/80">Tu logo, tus colores y tu premio. Paga el primer mes de Starter y el segundo es gratis.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={whatsapp} target="_blank" rel="noopener" className={`${btn} bg-coal text-white`}>
                <MessageCircle className="size-5 shrink-0" /> Quiero Lazo para mi negocio
              </a>
              <Link href="/#planes" className={`${btn} border-2 border-coal text-coal`}>
                Ver planes
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PieSitio />
    </div>
  );
}
