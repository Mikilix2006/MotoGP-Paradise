import { Suspense } from "react";

import { Header } from "@/components/Header";
import ResultsPage from "@/components/ResultsPage";

export const metadata = {
  title: "Resultados | MotoGPStats",
  description: "Clasificación de cualquier sesión de MotoGP, Moto2, Moto3 y categorías históricas desde 1949",
};

export default function ResultadosPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          <h1 className="page-title text-5xl font-display font-black md:text-7xl">Resultados</h1>
        </div>

        {/* useSearchParams exige Suspense en el build. */}
        <Suspense fallback={<div className="section" role="status" aria-busy="true" aria-label="Cargando resultados" />}>
          <ResultsPage />
        </Suspense>
      </section>
    </main>
  );
}
