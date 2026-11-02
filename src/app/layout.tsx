import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { DemoProvider } from "@/lib/demo/store";
import { PLATFORM_NAME } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: "Plataforma de fidelización digital de marca blanca.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${display.variable}`}>
      <body className="font-sans">
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
