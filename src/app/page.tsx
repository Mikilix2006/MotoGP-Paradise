import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { CalendarDays, MapPin, Trophy, ArrowUpRight } from "lucide-react";
import { NextGrandPrix } from "@/components/NextGrandPrix";
import RiderStandings from "@/components/RiderStandings";
import ChampionshipStats from "@/components/ChampionshipStats";

export default function Home() {
  return (
    <main className="min-h-screen grid-bg">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">

        <div className="grid gap-5 lg:grid-cols-[1.65fr_.85fr]">
          {/* HERO / PRÓXIMO GP */}
          <NextGrandPrix />

          {/* ESTADÍSTICAS REALES */}
          <ChampionshipStats />
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          {/* CLASIFICACIÓN */}
          <div className="card overflow-hidden">
          <RiderStandings />
          </div>

          <aside className="card p-6">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Índice estadístico</p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-black"><Trophy className="text-red-500"/> Favoritos del GP</h2>
            <div className="mt-7 space-y-5">
              {[["Francesco Bagnaia", "92"], ["Marc Márquez", "89"], ["Jorge Martín", "84"]].map((r, i) => (
                <div key={r[0]}><div className="flex justify-between text-sm"><span><b className="mr-3 text-zinc-600">0{i+1}</b>{r[0]}</span><b>{r[1]}/100</b></div><div className="mt-2 h-2 rounded-full bg-zinc-800"><div className="h-2 rounded-full bg-red-600" style={{width: r[1]+"%"}}/></div></div>
              ))}
            </div>
            <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-relaxed text-zinc-500">El índice combina rendimiento de temporada, forma reciente e historial en el circuito.</p>
          </aside>
        </section>
      </section>
    </main>
  );
}
