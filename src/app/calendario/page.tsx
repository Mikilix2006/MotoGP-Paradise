import { SITE_NAME } from "@/lib/site";
import { Header } from "@/components/Header";
import { CalendarView } from "@/components/CalendarView";

export const metadata = {
  title: `Calendario | ${SITE_NAME}`,
  description: "Calendario de Grandes Premios de MotoGP",
};

export default function CalendarPage() {
  return (
    <main className="flex-1">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <div className="mb-8">
          <h1 className="page-title text-5xl font-display font-black md:text-7xl">
            Calendario <span className="text-red-600">2026</span>
          </h1>
        </div>

        <CalendarView />
      </section>
    </main>
  );
}
