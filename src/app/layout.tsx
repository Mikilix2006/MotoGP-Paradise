import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotoGP Stats",
  description: "Estadísticas, pilotos y próximo Gran Premio"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
