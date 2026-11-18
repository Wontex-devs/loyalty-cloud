import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Bricolage_Grotesque, Playfair_Display, Dancing_Script, Nunito, Bebas_Neue, Montserrat } from "next/font/google";
import { PLATFORM_NAME, SITE_URL } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
// Misma letra de la página de venta, disponible en todo el sitio para títulos y cifras.
const poster = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-poster" });
// Letras que cada comercio puede elegir para su tarjeta. Sin precarga: el navegador solo
// descarga la que usa la tarjeta que se está viendo.
const elegante = Playfair_Display({ subsets: ["latin"], weight: ["600"], variable: "--font-card-elegante", preload: false });
const manuscrita = Dancing_Script({ subsets: ["latin"], weight: ["600"], variable: "--font-card-manuscrita", preload: false });
const redondeada = Nunito({ subsets: ["latin"], weight: ["700"], variable: "--font-card-redondeada", preload: false });
const impacto = Bebas_Neue({ subsets: ["latin"], weight: ["400"], variable: "--font-card-impacto", preload: false });
const geometrica = Montserrat({ subsets: ["latin"], weight: ["600"], variable: "--font-card-geometrica", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Por defecto nada se indexa: cada página pública nueva debe pedir `robots: { index: true }` (como la portada).
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: "Lazo: tarjeta de sellos digital con la marca de tu negocio, en Apple Wallet y Google Wallet, con sellos por NFC.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={[inter, display, poster, elegante, manuscrita, redondeada, impacto, geometrica].map((f) => f.variable).join(" ")}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
