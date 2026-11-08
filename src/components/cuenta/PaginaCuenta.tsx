import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { titular } from "@/components/legal";
import { registroAbierto } from "@/lib/registro";

/**
 * Con el registro cerrado, las páginas de cuenta (y las legales de cuentas) no existen.
 * Con él abierto en producción y sin nombre de titular, fallan en voz alta en vez de publicar textos incompletos.
 */
export function exigirRegistroAbierto() {
  if (!registroAbierto()) notFound();
  titular();
}

export default function PaginaCuenta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="flex-1">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          <h1 className="page-title text-5xl font-display font-black md:text-7xl">{titulo}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
