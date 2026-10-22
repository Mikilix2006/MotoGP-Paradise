import type { Metadata } from "next";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";

export const metadata: Metadata = {
  title: "MotoGP Stats",
  description: "Estadísticas, pilotos y próximo Gran Premio"
};

// Fija el tema antes de pintar (claro por defecto) para evitar parpadeo.
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>{children}<ScrollToTop /></body>
    </html>
  );
}
