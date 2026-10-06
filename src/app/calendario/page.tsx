import { Header } from "@/components/Header";
import { CalendarView } from "@/components/CalendarView";

export const metadata = {
  title: "Calendario | MotoGPStats",
  description: "Calendario de Grandes Premios de MotoGP",
};

export default function CalendarPage() {
  return (
    <main className="min-h-screen grid-bg">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-black md:text-5xl">
            Calendario <span className="text-red-600">2026</span>
          </h1>
        </div>

        <CalendarView />
      </section>
    </main>
  );
}
