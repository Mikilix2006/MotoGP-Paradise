"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { ChevronDown, ImageOff, LoaderCircle } from "lucide-react";

import CountryFlag from "@/components/CountryFlag";
import type {
  CarouselCategory,
  RiderCarouselItem,
} from "@/types/riderCarousel";
import { RiderStatsCard, type StatsTabKey } from "./RiderStatsCard";

export type ImageIssueReason = "null" | "error";

export type ImageIssueHandler = (
  rider: { id: string; full_name: string; image_url: string | null },
  reason: ImageIssueReason
) => void;

// A partir de este largo la biografía se recorta a 4 líneas con «Leer más».
const BIO_COLLAPSE_AT = 280;

const EYEBROW = "text-xs uppercase tracking-widest text-zinc-500";

// Color de equipo solo si es un hex válido y no es casi negro (#262626, el «sin color» de la API).
// Se mira el canal más alto y no la luminancia: rojos y azules oscuros (Ducati #ad0000, Yamaha #0a2d82) sí se ven.
function visibleTeamColor(color: string | null | undefined): string | null {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return Math.max(r, g, b) < 64 ? null : color;
}

// Edad en años cumplidos a partir de yyyy-mm-dd (sin pasar por Date para evitar desfases de zona horaria).
function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

// Descripción de reserva cuando no hay biografía: dorsal, país, edad, ciudad, equipo y marca.
function fallbackDescription(rider: RiderCarouselItem): string {
  const age = ageFrom(rider.birth_date);
  return [
    rider.number !== null ? `Dorsal #${rider.number}` : null,
    rider.country?.name ?? null,
    age !== null ? `${age} años` : null,
    rider.birth_city ? `Nacido en ${rider.birth_city}` : null,
    rider.team?.name ?? null,
    rider.constructor_name ? `Moto ${rider.constructor_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function RiderImage({
  rider,
  teamColor,
  priority,
  onImageIssue,
}: {
  rider: RiderCarouselItem;
  teamColor: string | null;
  priority: boolean;
  onImageIssue: ImageIssueHandler;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const missing = !rider.image_url;

  // El aviso de «sin imagen» se envía al mostrar al piloto; el carrusel descarta los repetidos.
  useEffect(() => {
    if (missing) onImageIssue(rider, "null");
  }, [missing, rider, onImageIssue]);

  return (
    <div
      className="card relative h-[26rem] overflow-hidden sm:h-[32rem] lg:h-auto lg:min-h-[40rem]"
      style={
        teamColor
          ? {
              backgroundImage: `linear-gradient(to bottom right, ${teamColor}45, transparent 60%)`,
            }
          : undefined
      }
    >
      {missing || failed ? (
        <div className="absolute inset-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-white/5 bg-zinc-900/50 px-6 text-center">
          <ImageOff size={28} className="text-zinc-500" />
          <p className="text-sm text-zinc-500">Imagen del piloto no disponible</p>
        </div>
      ) : (
        <>
          {!loaded && (
            <div
              role="status"
              aria-label="Cargando imagen del piloto"
              className="absolute inset-0 flex items-center justify-center"
            >
              <LoaderCircle
                size={28}
                className="animate-spin text-zinc-500 motion-reduce:animate-none"
              />
            </div>
          )}
          <Image
            src={rider.image_url as string}
            alt={`Retrato de ${rider.full_name}`}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 480px, 380px"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              onImageIssue(rider, "error");
            }}
            className={`object-contain object-bottom p-3 lg:object-cover lg:object-top transition-opacity duration-300 motion-reduce:transition-none ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}
    </div>
  );
}

function RiderBio({ rider }: { rider: RiderCarouselItem }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const bio = rider.biography?.trim() ?? "";
  const long = bio.length > BIO_COLLAPSE_AT;
  const collapsed = long && !open;

  return (
    <div>
      <p className={EYEBROW}>Sobre el piloto</p>

      {bio ? (
        <>
          <div
            id={bodyId}
            // Con scroll propio el texto debe poder recorrerse con el teclado.
            tabIndex={open ? 0 : undefined}
            className={`mt-2 text-sm leading-relaxed text-zinc-400 ${
              open ? "max-h-64 space-y-3 overflow-y-auto pr-2 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50" : ""
            }`}
          >
            {collapsed ? (
              <p className="line-clamp-4">{bio.replace(/\s*\n+\s*/g, " ")}</p>
            ) : (
              bio.split(/\n{2,}/).map((paragraph, i) => <p key={i}>{paragraph}</p>)
            )}
          </div>

          {long && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((value) => !value)}
              className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg text-xs font-bold uppercase tracking-wider text-red-400 transition hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 motion-reduce:transition-none sm:min-h-8"
            >
              {open ? "Leer menos" : "Leer más"}
              <ChevronDown
                size={14}
                className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {fallbackDescription(rider) || "Todavía no hay descripción de este piloto."}
        </p>
      )}
    </div>
  );
}

export function RiderSlide({
  rider,
  season,
  category,
  priority,
  tab,
  onTabChange,
  onImageIssue,
}: {
  rider: RiderCarouselItem;
  season: number;
  category: CarouselCategory;
  priority: boolean;
  tab: StatsTabKey;
  onTabChange: (tab: StatsTabKey) => void;
  onImageIssue: ImageIssueHandler;
}) {
  const teamColor = visibleTeamColor(rider.team?.color);
  // Nombre largo: una talla menos para que no pase a dos líneas y mueva la ficha.
  const longName = rider.full_name.length > 20;

  return (
    <article className="grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
      <RiderImage
        rider={rider}
        teamColor={teamColor}
        priority={priority}
        onImageIssue={onImageIssue}
      />

      <div className="flex min-w-0 flex-col gap-6">
        {/* IDENTIDAD */}
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-4 w-1 shrink-0 rounded-full ${teamColor ? "" : "bg-red-600"}`}
              style={teamColor ? { backgroundColor: teamColor } : undefined}
            />
            <p className="truncate text-xs font-bold uppercase tracking-[.18em] text-zinc-400">
              {rider.team?.name ?? "Sin equipo"}
            </p>
          </div>

          <h2
            className={`mt-3 break-words font-black leading-9 text-white md:leading-[3rem] lg:leading-10 xl:leading-[3rem] ${
              longName
                ? "text-2xl md:text-5xl lg:text-3xl xl:text-4xl"
                : "text-3xl md:text-5xl lg:text-4xl xl:text-5xl"
            }`}
          >
            {rider.full_name}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {rider.number !== null && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-wider text-red-400">
                #{rider.number}
              </span>
            )}
            {rider.country && (
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                <CountryFlag
                  size="sm"
                  url={rider.country.flag_url}
                  iso={rider.country.iso}
                  name={rider.country.name}
                />
                {rider.country.name}
              </span>
            )}
            {rider.constructor_name && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                {rider.constructor_name}
              </span>
            )}
          </div>
        </div>

        <RiderBio rider={rider} />

        <RiderStatsCard
          rider={rider}
          season={season}
          category={category}
          tab={tab}
          onTabChange={onTabChange}
        />
      </div>
    </article>
  );
}
