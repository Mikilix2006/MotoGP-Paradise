import { Header } from "@/components/Header";
import { NextGrandPrix } from "@/components/NextGrandPrix";
import RiderStandings from "@/components/RiderStandings";
import ChampionshipStats from "@/components/ChampionshipStats";
import GrandPrixFavorites from "@/components/GrandPrixFavorites";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">

        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[1.65fr_.85fr]">
          {/* HERO / PRÓXIMO GP */}
          <NextGrandPrix />

          {/* ESTADÍSTICAS REALES */}
          <ChampionshipStats />
        </div>

        <section className="mt-16 grid gap-x-10 gap-y-12 lg:grid-cols-[1.25fr_.75fr] lg:items-start">
          {/* CLASIFICACIÓN */}
          <div className="order-2 overflow-hidden lg:order-1">
          <RiderStandings />
          </div>

          {/* FAVORITOS DEL GP */}
          <div className="order-1 lg:order-2">
            <GrandPrixFavorites />
          </div>
        </section>
      </section>
    </main>
  );
}
