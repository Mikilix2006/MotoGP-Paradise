import type { ReactNode } from "react";

import { Header } from "@/components/Header";

import { ARTICULO_LEGAL } from "./legal";

export default function PaginaLegal({ titulo, actualizacion, children }: { titulo: string; actualizacion: string; children: ReactNode }) {
  return (
    <main className="flex-1">
      <Header />
      <article className={ARTICULO_LEGAL}>
        <h1 className="page-title text-5xl font-display font-black md:text-7xl">{titulo}</h1>
        <p>Última actualización: {actualizacion}</p>
        {children}
      </article>
    </main>
  );
}
