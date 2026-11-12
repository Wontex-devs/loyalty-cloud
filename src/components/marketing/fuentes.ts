import { Bricolage_Grotesque, Onest } from "next/font/google";

/** Letras del sitio público: Bricolage para títulos y cifras, Onest para el texto. */
export const fuenteTitulos = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-poster" });
export const fuenteTexto = Onest({ subsets: ["latin"], variable: "--font-text" });

export const poster = "font-[family-name:var(--font-poster)] font-extrabold tracking-[-0.02em]";
