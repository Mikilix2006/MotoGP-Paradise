import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import RidersPage from "@/components/RidersPage";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Pilotos | ${SITE_NAME}`,
  description:
    "Pilotos de MotoGP, Moto2 y Moto3: clasificación, estadísticas, títulos y trayectoria",
};

export default function PilotosPage() {
  // Fotos y biografías oficiales sin permiso: fuera de producción (ver aviso legal).
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="flex-1">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          {/* Año fijo como en /calendario (deuda conocida de AGENTS.md). */}
          <h1 className="page-title text-5xl font-display font-black md:text-7xl">
            Pilotos <span className="text-red-600">2026</span>
          </h1>
        </div>

        <RidersPage />
      </section>
    </main>
  );
}
