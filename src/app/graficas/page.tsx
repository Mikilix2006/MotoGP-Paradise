import { SITE_NAME } from "@/lib/site";
import { Suspense } from "react";

import { Header } from "@/components/Header";
import GraficasPage from "@/components/graficas/GraficasPage";

export const metadata = {
  title: `Gráficas | ${SITE_NAME}`,
  description: "Evolución de los puntos de cada piloto a lo largo de la temporada en MotoGP, Moto2 y Moto3",
};

export default function GraficasRoute() {
  return (
    <main className="flex-1">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          <h1 className="page-title text-5xl font-display font-black md:text-7xl">Gráficas</h1>
        </div>

        {/* useSearchParams exige Suspense en el build. */}
        <Suspense
          fallback={
            <p role="status" aria-busy="true" className="py-10 text-center text-sm text-zinc-500">
              Cargando…
            </p>
          }
        >
          <GraficasPage />
        </Suspense>
      </section>
    </main>
  );
}
