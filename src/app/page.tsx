import { Header } from "@/components/Header";
import { NextGrandPrix } from "@/components/NextGrandPrix";
import RiderStandings from "@/components/RiderStandings";
import ChampionshipStats from "@/components/ChampionshipStats";
import GrandPrixFavorites from "@/components/GrandPrixFavorites";

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

          {/* FAVORITOS DEL GP */}
          <GrandPrixFavorites />
        </section>
      </section>
    </main>
  );
}
