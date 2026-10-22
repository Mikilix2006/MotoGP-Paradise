"use client";

import { useEffect, useState } from "react";

import CountryFlag from "./CountryFlag";

interface RiderCountry {
  iso: string;
  name: string;
  flag_url: string | null;
}

interface RiderTeam {
  id: string;
  name: string;
  legacy_id: number;
  color: string | null;
}

interface RiderStatistics {
  constructor: string;
  starts: number;
  first_position: number;
  second_position: number;
  third_position: number;
  podiums: number;
  poles: number;
  points: number;
  position: number;
}

interface MotoGPRider {
  id: string;
  full_name: string;
  country: RiderCountry;
  legacy_id: number;
  riders_id: string;
  number: number;
  team: RiderTeam;
  statistics: RiderStatistics;
}

interface ApiResponse {
  data: MotoGPRider[];
}

interface ConstructorStanding {
  id: string;
  name: string;
  position: number;
  points: number;
  wins: number;
  poles: number;
  color: string | null;
}

type View = "riders" | "constructors";

// Color de marca por constructor: el color de Team en la BD es el de la librea (p. ej. Aprilia #262626) y falta en algunos pilotos.
const BRAND_COLORS: Record<string, string> = {
  ducati: "#dc0000",
  aprilia: "#7e22ce",
  ktm: "#ff6600",
  honda: "#e60012",
  yamaha: "#1d4ed8",
  suzuki: "#0ea5e9",
};

// Sin degradados decorativos: se mantiene la firma para no tocar los usos.
function teamGradient(_constructorName: string | null | undefined): React.CSSProperties | undefined {
  return undefined;
}

function StandingsSkeleton({ label = "Piloto" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando clasificación">
      <div className="hidden grid-cols-[52px_minmax(0,1fr)_90px_80px] items-center gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:grid">
        <span>Pos.</span>
        <span>{label}</span>
        <span className="text-center">Victorias</span>
        <span className="text-right">Puntos</span>
      </div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="grid animate-pulse grid-cols-[42px_minmax(0,1fr)_70px] items-center gap-3 border-b border-white/5 px-5 py-4 sm:grid-cols-[52px_minmax(0,1fr)_90px_80px] sm:gap-4 sm:px-6"
        >
          <div className="h-8 w-8 rounded-lg bg-white/5" />
          <div className="h-4 w-2/3 rounded bg-white/5" />
          <div className="ml-auto h-5 w-10 rounded bg-white/5 sm:col-start-4" />
        </div>
      ))}
    </div>
  );
}

// La BD no guarda el país del constructor: mapa fijo por nombre (sin coincidencia, sin bandera).
const CONSTRUCTOR_COUNTRIES: Record<string, { iso: string; name: string }> = {
  aprilia: { iso: "IT", name: "Italia" },
  ducati: { iso: "IT", name: "Italia" },
  ktm: { iso: "AT", name: "Austria" },
  honda: { iso: "JP", name: "Japón" },
  yamaha: { iso: "JP", name: "Japón" },
  suzuki: { iso: "JP", name: "Japón" },
};

function constructorCountry(name: string) {
  const key = name.toLowerCase();
  const match = Object.keys(CONSTRUCTOR_COUNTRIES).find((k) => key.includes(k));
  return match ? CONSTRUCTOR_COUNTRIES[match] : null;
}

function ConstructorsTable({
  constructors,
  error,
  flagUrls,
}: {
  constructors: ConstructorStanding[] | null;
  error: string | null;
  flagUrls: Record<string, string>; // iso -> url, tomadas de los pilotos
}) {
  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-none border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!constructors) return <StandingsSkeleton label="Equipo" />;

  if (constructors.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-none border border-white/5 bg-zinc-900/50 py-10 text-center text-sm text-zinc-500">
          Todavía no hay puntos de constructores esta temporada.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* CABECERA DE COLUMNAS */}
      <div className="hidden grid-cols-[52px_minmax(0,1fr)_90px_80px] items-center gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:grid">
        <span>Pos.</span>
        <span>Equipo</span>
        <span className="text-center">Victorias</span>
        <span className="text-right">Puntos</span>
      </div>

      {constructors.map((item) => (
        <div
          key={item.id}
          style={teamGradient(item.name)}
          className="grid grid-cols-[42px_minmax(0,1fr)_70px] items-center gap-3 border-b border-white/5 px-5 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[52px_minmax(0,1fr)_90px_80px] sm:gap-4 sm:px-6"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black ${
              item.position <= 3
                ? "bg-red-600 text-[#fff]"
                : "bg-white/5 text-zinc-300"
            }`}
          >
            {String(item.position).padStart(2, "0")}
          </span>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Hueco fijo de 24 px: sin país queda vacío y los nombres alinean */}
            <div className="flex w-6 shrink-0 justify-center">
              {(() => {
                const country = constructorCountry(item.name);
                return (
                  country && (
                    <CountryFlag
                      size="sm"
                      url={
                        flagUrls[country.iso] ??
                        `https://photos.motogp.com/countries/flags/iso2/${country.iso}.svg`
                      }
                      iso={country.iso}
                      name={country.name}
                    />
                  )
                );
              })()}
            </div>
            <h3 className="truncate font-bold text-white">{item.name}</h3>
          </div>

          <div className="hidden text-center sm:block">
            <p className="text-sm font-bold text-white">{item.wins}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              Victorias
            </p>
          </div>

          <div className="text-right">
            <p className="text-lg font-black text-white">{item.points}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              pts
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RiderStandings() {
  const [riders, setRiders] = useState<MotoGPRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>("riders");
  const [constructors, setConstructors] = useState<ConstructorStanding[] | null>(null);
  const [constructorsError, setConstructorsError] = useState<string | null>(null);

  // Los constructores se piden la primera vez que se abre la pestaña.
  useEffect(() => {
    if (view !== "constructors" || constructors || constructorsError) return;

    fetch("/api/constructors/standings")
      .then((response) => {
        if (!response.ok) {
          throw new Error("No se pudo obtener la clasificación de constructores");
        }
        return response.json();
      })
      .then((result: { data: ConstructorStanding[] }) =>
        setConstructors(result.data)
      )
      .catch((err) => {
        console.error("Error cargando constructores:", err);
        setConstructorsError(
          "No se pudo cargar la clasificación de constructores"
        );
      });
  }, [view, constructors, constructorsError]);

  useEffect(() => {
    async function loadRiders() {
      try {
        setLoading(true);

        const response = await fetch(
          "/api/riders/standings"
        );

        if (!response.ok) {
          throw new Error(
            "No se pudo obtener la clasificación"
          );
        }

        const result: ApiResponse =
          await response.json();

        setRiders(result.data);
      } catch (error) {
        console.error(
          "Error cargando clasificación:",
          error
        );

        setError(
          "No se pudo cargar la clasificación de pilotos"
        );
      } finally {
        setLoading(false);
      }
    }

    loadRiders();
  }, []);

  return (
    <section>
      {/* CABECERA */}
      <div className="flex flex-col items-center gap-3 border-b border-white/10 p-6 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Campeonato
          </p>

          <h2 className="mt-1 flex items-center justify-center gap-2 text-2xl font-black sm:justify-start">
            {view === "riders"
              ? "Clasificación de pilotos"
              : "Clasificación de constructores"}
          </h2>
        </div>

        {!loading && !error && view === "riders" && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
            {riders.length} pilotos
          </span>
        )}

        {view === "constructors" && constructors && constructors.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
            {constructors.length} equipos
          </span>
        )}
      </div>

      {/* SELECTOR */}
      <div className="flex gap-2 border-b border-white/10 px-6 py-3">
        {(
          [
            ["riders", "Pilotos"],
            ["constructors", "Constructores"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
              view === key
                ? "border-red-500/30 bg-red-600 text-[#fff]"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "constructors" && (
        <ConstructorsTable
          constructors={constructors}
          error={constructorsError}
          flagUrls={Object.fromEntries(
            riders.flatMap((r) =>
              r.country.iso && r.country.flag_url
                ? [[r.country.iso, r.country.flag_url]]
                : []
            )
          )}
        />
      )}

      {/* CARGANDO */}
      {view === "riders" && loading && <StandingsSkeleton />}

      {/* ERROR */}
      {view === "riders" && error && (
        <div className="p-6">
          <div className="rounded-none border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
            {error}
          </div>
        </div>
      )}

      {/* CLASIFICACIÓN */}
      {view === "riders" && !loading && !error && (
        <div>
          {/* CABECERA DE COLUMNAS */}
          <div className="hidden grid-cols-[52px_minmax(0,1fr)_90px_80px] items-center gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:grid">
            <span>Pos.</span>

            <span>Piloto</span>

            <span className="text-center">
              Victorias
            </span>

            <span className="text-right">
              Puntos
            </span>
          </div>

          {/* PILOTOS */}
          <div>
            {riders.map((rider) => (
              <div
                key={rider.id}
                style={teamGradient(rider.statistics.constructor)}
                className="grid grid-cols-[42px_minmax(0,1fr)_70px] items-center gap-3 border-b border-white/5 px-5 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[52px_minmax(0,1fr)_90px_80px] sm:gap-4 sm:px-6"
              >
                {/* POSICIÓN */}
                <div>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black ${
                      rider.statistics.position <= 3
                        ? "bg-red-600 text-[#fff]"
                        : "bg-white/5 text-zinc-300"
                    }`}
                  >
                    {String(
                      rider.statistics.position
                    ).padStart(2, "0")}
                  </span>
                </div>

                {/* PILOTO */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="min-w-7 text-sm font-black text-red-500">
                      #{rider.number}
                    </span>

                    {/* Hueco fijo de 24 px: sin país queda vacío y los
                        nombres siguen alineados entre filas */}
                    <div className="flex w-6 shrink-0 justify-center">
                      {rider.country.iso && (
                        <CountryFlag
                          size="sm"
                          url={rider.country.flag_url}
                          iso={rider.country.iso}
                          name={rider.country.name}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-white">
                        {rider.full_name}
                      </h3>

                      <p className="truncate text-xs text-zinc-500">
                        {rider.team.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* VICTORIAS */}
                <div className="hidden text-center sm:block">
                  <p className="text-sm font-bold text-white">
                    {rider.statistics.first_position}
                  </p>

                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Victorias
                  </p>
                </div>

                {/* PUNTOS */}
                <div className="text-right">
                  <p className="text-lg font-black text-white">
                    {rider.statistics.points}
                  </p>

                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}