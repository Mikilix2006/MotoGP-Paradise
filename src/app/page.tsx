import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { CalendarDays, MapPin, Trophy, ArrowUpRight } from "lucide-react";
import { NextGrandPrix } from "@/components/NextGrandPrix";

const riders = [
  ["1", "Francesco Bagnaia", "Ducati Lenovo Team", "282", "+18"],
  ["2", "Marc Márquez", "Ducati Lenovo Team", "264", "+11"],
  ["3", "Jorge Martín", "Aprilia Racing", "241", "+6"],
  ["4", "Fabio Quartararo", "Monster Energy Yamaha", "196", "+2"],
  ["5", "Pedro Acosta", "Red Bull KTM", "184", "+9"]
];

export default function Home() {
  return (
    <main className="min-h-screen grid-bg">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
          {/* 
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-red-500">Próxima carrera</p>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">Gran Premio de Catalunya</h1>
            <p className="mt-3 flex items-center gap-2 text-zinc-400"><MapPin size={17}/> Circuit de Barcelona-Catalunya · Montmeló, España</p>
          </div>
          <div className="hidden text-right md:block"><p className="text-xs uppercase tracking-widest text-zinc-500">Cuenta atrás</p><p className="mt-2 text-2xl font-bold">03D 14H 22M</p></div>
        </div>
          */}

        <div className="grid gap-5 lg:grid-cols-[1.65fr_.85fr]">
          <NextGrandPrix />
          {/* 
          <article className="card relative overflow-hidden p-7 md:p-10">
            <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-12 flex items-center justify-between"><span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">ROUND 15</span><CalendarDays className="text-zinc-500"/></div>
              <p className="text-zinc-400">5 — 7 SEPTIEMBRE 2026</p>
              <h2 className="mt-3 max-w-xl text-3xl font-black md:text-5xl">Todo listo para el próximo fin de semana de MotoGP.</h2>
              <div className="mt-10 flex gap-3"><button className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold">Ver evento</button><button className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold">Calendario</button></div>
            </div>
          </article>
          */}
          

          <div className="grid grid-cols-2 gap-5">
            <StatCard label="Líder del mundial" value="282 pts" note="Francesco Bagnaia" />
            <StatCard label="Victorias" value="6" note="Esta temporada" />
            <StatCard label="Última carrera" value="P1" note="Ganador reciente" />
            <StatCard label="Circuito" value="4.63 km" note="14 curvas" />
          </div>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div><p className="text-xs uppercase tracking-widest text-zinc-500">Campeonato 2026</p><h2 className="mt-1 text-2xl font-black">Clasificación de pilotos</h2></div>
              <button className="flex items-center gap-1 text-sm text-red-500">Ver tabla <ArrowUpRight size={15}/></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-5">Pos.</th><th>Piloto</th><th>Equipo</th><th className="text-right">Pts</th><th className="p-5 text-right">Forma</th></tr></thead>
                <tbody>{riders.map(r => <tr key={r[0]} className="border-t border-white/5 hover:bg-white/[.025]"><td className="p-5 font-bold">{r[0]}</td><td className="font-bold">{r[1]}</td><td className="text-zinc-500">{r[2]}</td><td className="text-right font-bold">{r[3]}</td><td className="p-5 text-right text-emerald-400">{r[4]}</td></tr>)}</tbody>
              </table>
            </div>
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
