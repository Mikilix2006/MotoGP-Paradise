import type { Metadata } from "next";
import "./globals.css";
import GridBackground from "@/components/GridBackground";
import ScrollToTop from "@/components/ScrollToTop";

export const metadata: Metadata = {
  title: "MotoGP Stats",
  description: "Estadísticas, pilotos y próximo Gran Premio"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><GridBackground />{children}<ScrollToTop /></body></html>;
}
