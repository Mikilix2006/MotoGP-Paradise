"use client";

import { useId, useRef } from "react";
import { BarChart3, Info, Trophy } from "lucide-react";

import type {
  CarouselCategory,
  RiderCarouselItem,
  RiderTrajectoryStep,
} from "@/types/riderCarousel";

export type StatsTabKey =
  | "season"
  | "wins"
  | "races"
  | "titles"
  | "trajectory";

const TABS: { key: StatsTabKey; label: string }[] = [
  { key: "season", label: "Temporada" },
  { key: "wins", label: "Victorias y poles" },
  { key: "races", label: "Carreras" },
  { key: "titles", label: "Mundiales" },
  { key: "trajectory", label: "Trayectoria" },
];

const NUMBER = new Intl.NumberFormat("es-ES");

const EYEBROW =
  "text-[10px] font-bold uppercase tracking-widest text-zinc-500";

// Los nombres de categoría llegan tal cual de la BD ("MotoGP™", "Moto2™"): sin la marca registrada.
function cleanCategory(category: string): string {
  return category.replace(/™/g, "");
}

function Cell({
  label,
  value,
  big = false,
}: {
  label: string;
  value: number | string | null;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <p className={EYEBROW}>{label}</p>
      <p
        className={`mt-2 font-black text-white ${big ? "text-4xl" : "text-3xl"}`}
      >
        {typeof value === "number" ? NUMBER.format(value) : (value ?? "—")}
      </p>
    </div>
  );
}

function Group({
  title,
  children,
  gridClass,
}: {
  title: string;
  children: React.ReactNode;
  gridClass: string;
}) {
  return (
    <div>
      <p className={EYEBROW}>{title}</p>
      <div className={`mt-2 grid gap-3 ${gridClass}`}>{children}</div>
    </div>
  );
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

  return (
    <div className="space-y-3">
      <p className={EYEBROW}>
        Temporada {season} · {category}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Cell
          big
          label="Posición"
          value={stats.position === null ? null : `${stats.position}º`}
        />
        <Cell big label="Puntos" value={stats.points} />
      </div>
      <div
        className={`grid gap-3 ${
          hasSprints ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
        }`}
      >
        <Cell label="Victorias" value={stats.wins} />
        <Cell label="Podios" value={stats.podiums} />
        <Cell label="Poles" value={stats.poles} />
        {hasSprints && <Cell label="Sprints ganadas" value={stats.sprint_wins} />}
      </div>
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
      <Group title="Toda la carrera" gridClass="grid-cols-2">
        <Cell label="Victorias" value={career.wins} />
        <Cell label="Poles" value={career.poles} />
      </Group>

      {/* Solo pilotos de MotoGP: Moto2 y Moto3 no muestran esta parte ni como «0». */}
      {motogp && (
        <>
          <Group title="En MotoGP" gridClass="grid-cols-3">
            <Cell label="Victorias" value={motogp.wins} />
            <Cell label="Poles" value={motogp.poles} />
            <Cell label="Sprints ganadas" value={motogp.sprint_wins} />
          </Group>
          {showPremier && (
            <Group title="Clase reina · 500cc + MotoGP" gridClass="grid-cols-2">
              <Cell label="Victorias" value={motogp.premier_wins} />
              <Cell label="Poles" value={motogp.premier_poles} />
            </Group>
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
  return (
    <div className="space-y-5">
      <Group title="Toda la carrera" gridClass="grid-cols-2">
        <Cell big label="Carreras disputadas" value={rider.career.starts} />
        <Cell big label="Podios" value={rider.career.podiums} />
      </Group>
      {rider.motogp && (
        <Note>Solo cuentan las carreras del domingo, sin las sprint.</Note>
      )}
    </div>
  );
}

function TitlesPanel({ rider }: { rider: RiderCarouselItem }) {
  const titles = rider.career.titles.filter((t) => t.years.length > 0);
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

      <ul className="space-y-3">
        {titles.map((title) => (
          <li
            key={title.category}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 font-bold text-white">
                <Trophy size={16} className="shrink-0 text-red-500" />
                <span className="truncate">{cleanCategory(title.category)}</span>
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
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-white"
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

            <p className="mt-1 text-sm text-zinc-100">{step.team_name ?? "—"}</p>
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
        className="mt-5 h-[22rem] overflow-y-auto border-t border-white/10 pt-5[scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 sm:h-[20rem]"
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
