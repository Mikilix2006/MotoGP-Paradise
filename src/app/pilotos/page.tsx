import { Header } from "@/components/Header";
import RidersPage from "@/components/RidersPage";

export const metadata = {
  title: "Pilotos | MotoGPStats",
  description:
    "Pilotos de MotoGP, Moto2 y Moto3: clasificación, estadísticas, títulos y trayectoria",
};

export default function PilotosPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          {/* Año fijo como en /calendario (deuda conocida de AGENTS.md). */}
          <h1 className="text-4xl font-display font-black md:text-6xl">
            Pilotos <span className="text-red-600">2026</span>
          </h1>
        </div>

        <RidersPage />
      </section>
    </main>
  );
}
