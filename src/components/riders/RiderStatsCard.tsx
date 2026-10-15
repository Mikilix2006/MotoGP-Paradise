"use client";

import { useId, useRef } from "react";
import { BarChart3, Info, Trophy } from "lucide-react";

import type {
  CarouselCategory,
  RiderCarouselItem,
  RiderTrajectoryStep,
} from "@/types/riderCarousel";

export type StatsTabKey = "season" | "wins" | "races" | "titles" | "trajectory";

const TABS: { key: StatsTabKey; label: string }[] = [
  { key: "season", label: "Temporada" },
  { key: "wins", label: "Victorias y poles" },
  { key: "races", label: "Carreras" },
  { key: "titles", label: "Mundiales" },
  { key: "trajectory", label: "Trayectoria" },
];

const NUMBER = new Intl.NumberFormat("es-ES");

const EYEBROW = "text-[10px] font-bold uppercase tracking-widest text-zinc-500";

// Los nombres de categoría llegan tal cual de la BD ("MotoGP™", "Moto2™"): sin la marca registrada.
function cleanCategory(category: string): string {
  return category.replace(/™/g, "");
}

function Stat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: number | string | null;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={EYEBROW}>{label}</p>
      <p
        className={`mt-1 font-black text-white ${big ? "text-4xl" : "text-3xl"}`}
      >
        {typeof value === "number" ? NUMBER.format(value) : (value ?? "—")}
      </p>
    </div>
  );
}

// Sección de texto: las que no son la primera se separan con una línea sutil.
function Section({
  title,
  children,
  gridClass,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  gridClass: string;
  accent?: boolean;
}) {
  return (
    <section className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <p
        className={
          accent
            ? "text-[10px] font-bold uppercase tracking-widest text-red-500"
            : EYEBROW
        }
      >
        {title}
      </p>
      <div className={`mt-3 grid gap-x-4 gap-y-4 ${gridClass}`}>{children}</div>
    </section>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${NUMBER.format(n)} ${n === 1 ? one : many}`;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-zinc-500">
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/50 px-6 py-10 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

function SeasonPanel({
  rider,
  season,
  category,
}: {
  rider: RiderCarouselItem;
  season: number;
  category: CarouselCategory;
}) {
  const stats = rider.season_stats;

  if (!stats) {
    return (
      <Empty>
        Todavía no hay datos de {rider.full_name} en la temporada {season} de{" "}
        {category}, por ejemplo si es suplente y aún no ha corrido.
      </Empty>
    );
  }

  // sprint_wins solo existe en MotoGP: en Moto2 y Moto3 la celda no aparece.
  const hasSprints = stats.sprint_wins !== null;

  const parts = [
    stats.position !== null && `${stats.position}ª posición`,
    stats.points !== null && plural(stats.points, "punto", "puntos"),
    stats.wins !== null && plural(stats.wins, "victoria", "victorias"),
    stats.podiums !== null && plural(stats.podiums, "podio", "podios"),
    stats.poles !== null && plural(stats.poles, "pole", "poles"),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <Section
        title={`Temporada ${season} · ${category}`}
        gridClass="grid-cols-2"
        accent
      >
        <Stat
          big
          label="Posición"
          value={stats.position === null ? null : `${stats.position}º`}
        />
        <Stat big label="Puntos" value={stats.points} />
      </Section>
      <Section
        title="Resultados"
        gridClass={hasSprints ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}
      >
        <Stat label="Victorias" value={stats.wins} />
        <Stat label="Podios" value={stats.podiums} />
        <Stat label="Poles" value={stats.poles} />
        {hasSprints && (
          <Stat label="Sprints ganadas" value={stats.sprint_wins} />
        )}
      </Section>
      {parts.length > 0 && (
        <p className="border-t border-white/10 pt-4 text-sm text-zinc-400">
          En {season}, {parts.join(", ")}.
        </p>
      )}
    </div>
  );
}

function WinsPanel({ rider }: { rider: RiderCarouselItem }) {
  const { career, motogp } = rider;
  // Sin 500cc la clase reina repite «En MotoGP»: se oculta para que el panel quepa en la altura fija.
  const showPremier =
    motogp !== null &&
    (motogp.premier_wins !== motogp.wins ||
      motogp.premier_poles !== motogp.poles);

  return (
    <div className="space-y-4">
      <Section title="Toda la carrera" gridClass="grid-cols-2" accent>
        <Stat label="Victorias" value={career.wins} />
        <Stat label="Poles" value={career.poles} />
      </Section>

      {/* Solo pilotos de MotoGP: Moto2 y Moto3 no muestran esta parte ni como «0». */}
      {motogp && (
        <>
          <Section title="En MotoGP" gridClass="grid-cols-3">
            <Stat label="Victorias" value={motogp.wins} />
            <Stat label="Poles" value={motogp.poles} />
            <Stat label="Sprints ganadas" value={motogp.sprint_wins} />
          </Section>
          {showPremier && (
            <Section
              title="Clase reina · 500cc + MotoGP"
              gridClass="grid-cols-2"
            >
              <Stat label="Victorias" value={motogp.premier_wins} />
              <Stat label="Poles" value={motogp.premier_poles} />
            </Section>
          )}
        </>
      )}

      {/* Moto2 y Moto3 no mencionan las sprint ni en la nota. */}
      {motogp && (
        <Note>Los totales de carrera no incluyen las carreras sprint.</Note>
      )}
    </div>
  );
}

function RacesPanel({ rider }: { rider: RiderCarouselItem }) {
  const { starts, podiums } = rider.career;
  const podiumRate =
    typeof starts === "number" && typeof podiums === "number" && starts > 0
      ? Math.round((podiums / starts) * 100)
      : null;

  return (
    <div className="space-y-5">
      <Section title="Toda la carrera" gridClass="grid-cols-2" accent>
        <Stat big label="Carreras disputadas" value={rider.career.starts} />
        <Stat big label="Podios" value={rider.career.podiums} />
      </Section>
      {podiumRate !== null && (
        <p className="border-t border-white/10 pt-4 text-sm text-zinc-400">
          Sube al podio en el {podiumRate} % de las carreras que disputa.
        </p>
      )}
      {rider.motogp && (
        <Note>Solo cuentan las carreras del domingo, sin las sprint.</Note>
      )}
    </div>
  );
}

// Clase reina primero (MotoGP, 500cc), luego Moto2/250cc y por último Moto3/125cc.
function categoryRank(category: string): number {
  const name = cleanCategory(category).toLowerCase();
  if (name.includes("motogp") || name.includes("500")) return 0;
  if (name.includes("moto2") || name.includes("250")) return 1;
  if (name.includes("moto3") || name.includes("125")) return 2;
  return 3;
}

function TitlesPanel({ rider }: { rider: RiderCarouselItem }) {
  const titles = rider.career.titles
    .filter((t) => t.years.length > 0)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
  const total = titles.reduce((sum, t) => sum + t.years.length, 0);

  if (total === 0) {
    return (
      <Empty>
        <Trophy size={20} className="mx-auto mb-3 text-zinc-500" />
        {rider.full_name} todavía no ha ganado ningún Mundial.
        <span className="mt-1 block text-xs">
          La temporada en curso no cuenta hasta que termine.
        </span>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <p className="text-5xl font-black text-white">{total}</p>
        <p className="pb-1 text-sm text-zinc-400">
          {total === 1 ? "Mundial ganado" : "Mundiales ganados"}
        </p>
      </div>

      <ul className="divide-y divide-white/10 border-t border-white/10">
        {titles.map((title) => (
          <li key={title.category} className="py-4 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 font-bold text-white">
                <Trophy size={16} className="shrink-0 text-red-500" />
                <span className="truncate">
                  {cleanCategory(title.category)}
                </span>
              </p>
              <span className={EYEBROW}>
                {title.years.length}{" "}
                {title.years.length === 1 ? "título" : "títulos"}
              </span>
            </div>

            <ul className="mt-3 flex flex-wrap gap-2">
              {[...title.years]
                .sort((a, b) => a - b)
                .map((year) => (
                  <li
                    key={year}
                    className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-300"
                  >
                    {year}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>

      <Note>No incluye la temporada en curso.</Note>
    </div>
  );
}

interface TrajectoryGroup {
  from: number;
  to: number;
  step: RiderTrajectoryStep;
}

// Une temporadas consecutivas idénticas (misma categoría, equipo, marca y dorsal) en un solo tramo.
function groupTrajectory(steps: RiderTrajectoryStep[]): TrajectoryGroup[] {
  const groups: TrajectoryGroup[] = [];
  for (const step of [...steps].sort((a, b) => a.year - b.year)) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.step.category === step.category &&
      last.step.team_name === step.team_name &&
      last.step.constructor_name === step.constructor_name &&
      last.step.number === step.number
    ) {
      last.to = step.year;
    } else {
      groups.push({ from: step.year, to: step.year, step });
    }
  }
  return groups;
}

function TrajectoryPanel({ rider }: { rider: RiderCarouselItem }) {
  // Más reciente arriba: es lo que interesa y la lista larga (hasta 26 temporadas) se desplaza hacia el pasado.
  const groups = groupTrajectory(rider.trajectory).reverse();

  if (groups.length === 0) {
    return (
      <Empty>Todavía no hay trayectoria registrada de {rider.full_name}.</Empty>
    );
  }

  return (
    <div className="pl-2">
      <ol>
        {groups.map(({ from, to, step }, i) => (
          <li
            key={`${from}-${step.category}`}
            className="relative border-l border-white/10 pb-5 pl-5 last:pb-0"
          >
            <span
              aria-hidden="true"
              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${
                i === 0 ? "bg-red-500" : "bg-zinc-600"
              }`}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-white">
                {from === to ? from : `${from}–${to}`}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {cleanCategory(step.category)}
              </span>
              {step.number !== null && (
                <span className="text-sm font-black text-red-500">
                  #{step.number}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-zinc-100">
              {step.team_name ?? "—"}
            </p>
            {step.constructor_name && (
              <p className="text-xs text-zinc-500">{step.constructor_name}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RiderStatsCard({
  rider,
  season,
  category,
  tab,
  onTabChange,
}: {
  rider: RiderCarouselItem;
  season: number;
  category: CarouselCategory;
  tab: StatsTabKey;
  onTabChange: (tab: StatsTabKey) => void;
}) {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (key: StatsTabKey) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;

  // Flechas, Inicio y Fin cambian de pestaña; se frena el evento para que el carrusel no cambie de piloto.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((t) => t.key === tab);
    let next: number;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;

    event.preventDefault();
    event.stopPropagation();
    onTabChange(TABS[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="card p-5 sm:p-6">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        Estadísticas
      </p>
      <h3 className="mt-1 flex items-center gap-2 text-2xl font-black">
        <BarChart3 size={21} className="text-red-500" />
        Ficha estadística
      </h3>

      <div
        role="tablist"
        aria-label="Secciones de estadísticas"
        onKeyDown={handleKeyDown}
        className="mt-5 flex flex-wrap gap-2"
      >
        {TABS.map(({ key, label }, i) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(key)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(key)}
              className={`min-h-10 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 motion-reduce:transition-none ${
                selected
                  ? "border-red-500/30 bg-red-600 text-white"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(tab)}
        tabIndex={0}
        className="mt-5 h-[22rem] overflow-y-auto border-t border-white/10 pt-5 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 sm:h-[20rem]"
      >
        {tab === "season" && (
          <SeasonPanel rider={rider} season={season} category={category} />
        )}
        {tab === "wins" && <WinsPanel rider={rider} />}
        {tab === "races" && <RacesPanel rider={rider} />}
        {tab === "titles" && <TitlesPanel rider={rider} />}
        {tab === "trajectory" && <TrajectoryPanel rider={rider} />}
      </div>
    </div>
  );
}
