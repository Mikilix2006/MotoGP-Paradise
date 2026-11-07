import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";
import Footer from "@/components/Footer";
import { SITE_NAME } from "@/lib/site";

// Fuentes autoalojadas por Next (sin petición externa en runtime): Barlow Condensed para titulares y cifras, Barlow para el cuerpo.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800", "900"], style: ["normal", "italic"], display: "swap", variable: "--font-display" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-body" });

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Estadísticas, pilotos y próximo Gran Premio"
};

// Fija el tema antes de pintar (oscuro por defecto salvo que el usuario haya elegido claro) para evitar parpadeo.
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")!=="light")document.documentElement.dataset.theme="dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="flex min-h-screen flex-col">{children}<Footer /><ScrollToTop /></body>
    </html>
  );
}
