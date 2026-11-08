import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Bricolage_Grotesque } from "next/font/google";
import { DemoProvider } from "@/lib/demo/store";
import { PLATFORM_NAME } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
// Misma letra de la página de venta, disponible en todo el sitio para títulos y cifras.
const poster = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-poster" });

export const metadata: Metadata = {
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: "Plataforma de fidelización digital de marca blanca.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${display.variable} ${poster.variable}`}>
      <body className="font-sans">
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
