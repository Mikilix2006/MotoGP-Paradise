"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CarouselCategory,
  RiderCarouselResponse,
} from "@/types/riderCarousel";
import { RiderSlide, type ImageIssueHandler } from "./RiderSlide";
import type { StatsTabKey } from "./RiderStatsCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface RiderCarouselProps {
  status: "loading" | "error" | "ready";
  /** null mientras carga o si hay error. */
  data: RiderCarouselResponse | null;
  category: CarouselCategory;
  onCategoryChange: (category: CarouselCategory) => void;
  onRetry: () => void;
  onImageIssue: ImageIssueHandler;
}

// De menor a mayor categoría, como pidió el usuario.
const CATEGORIES: CarouselCategory[] = ["Moto3", "Moto2", "MotoGP"];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";

// Misma altura de la caja de imagen que usa RiderSlide por debajo de lg; centra las flechas en móvil.
const ARROW_BASE = `absolute top-[13rem] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black text-xl text-white transition duration-300 hover:border-red-600 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none sm:top-[16rem] lg:static lg:translate-y-0 lg:self-center ${FOCUS_RING}`;

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
    return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Piloto anterior" : "Piloto siguiente"}
      disabled={disabled}
      onClick={onClick}
      className={`${ARROW_BASE} ${direction === "prev" ? "left-2 lg:order-first" : "right-2 lg:order-last"}`}
    >
      {direction === "prev" ? <ChevronLeft size={22} aria-hidden /> : <ChevronRight size={22} aria-hidden />}
    </button>
  );
}

function CarouselSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando pilotos"
      className="animate-pulse motion-reduce:animate-none lg:grid lg:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] lg:items-center lg:gap-4"
    >
      <div className="hidden h-11 w-11 rounded-full bg-white/10 lg:block" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
        {/* IMAGEN */}
        <div className="card relative h-[26rem] sm:h-[32rem] lg:h-auto lg:min-h-[40rem]">
          <div className="absolute inset-6 mx-auto w-3/5 rounded-none bg-white/10" />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* IDENTIDAD */}
          <div>
            <div className="h-3 w-40 rounded bg-white/10" />
            <div className="mt-4 h-9 w-3/4 max-w-md rounded bg-white/10 md:h-14" />
            <div className="mt-4 flex gap-2">
              <div className="h-6 w-14 rounded-full bg-white/10" />
              <div className="h-6 w-24 rounded-full bg-white/10" />
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
          </div>

          {/* DESCRIPCIÓN */}
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-2/3 rounded bg-white/10" />
            <div className="!mt-4 h-4 w-20 rounded bg-white/10" />
          </div>

          {/* ESTADÍSTICAS */}
          <div className="card pt-5 sm:pt-6">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-3 h-7 w-52 rounded bg-white/10" />
            <div className="mt-5 flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-24 rounded-lg bg-white/10" />
              ))}
            </div>
            {/* Misma altura fija que el panel real para que al cargar no salte la ficha */}
            <div className="mt-5 h-[22rem] border-t border-white/10 pt-5 sm:h-[20rem]">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-none border border-white/10 bg-black/20" />
                <div className="h-24 rounded-none border border-white/10 bg-black/20" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-none border border-white/10 bg-black/20"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden h-11 w-11 rounded-full bg-white/10 lg:block" />
    </div>
  );
}

function ErrorState({
  category,
  onRetry,
}: {
  category: CarouselCategory;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="card flex min-h-[26rem] flex-col items-center justify-center gap-5 pt-8 text-center"
    >
      <div>
        <p className="font-medium text-red-400">
          No se han podido cargar los pilotos de {category}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-500/30 bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#fff] transition hover:bg-red-500 motion-reduce:transition-none ${FOCUS_RING}`}
      >
        Reintentar
      </button>
    </div>
  );
}

function EmptyState({
  category,
  season,
}: {
  category: CarouselCategory;
  season: number;
}) {
  return (
    <div className="card pt-6">
      <div className="rounded-none border border-white/5 bg-zinc-900/50 py-10 text-center text-sm text-zinc-500">
        Todavía no hay pilotos de {category} registrados en la temporada {season}.
      </div>
    </div>
  );
}

function CategorySelector({
  category,
  onChange,
}: {
  category: CarouselCategory;
  onChange: (category: CarouselCategory) => void;
}) {
  return (
    <div className="mt-6 flex justify-center">
      <div
        role="group"
        aria-label="Categoría"
        className="inline-flex rounded-none border border-white/10 bg-white/5 p-1"
      >
        {CATEGORIES.map((item) => {
          const active = item === category;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (!active) onChange(item);
              }}
              className={`min-h-11 rounded-lg px-5 text-xs font-bold uppercase tracking-wider transition motion-reduce:transition-none sm:px-8 ${FOCUS_RING} ${
                active
                  ? "bg-red-600 text-[#fff]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Se monta con key de categoría y temporada: al cambiar de categoría vuelve solo al primer piloto.
function Slides({
  data,
  onImageIssue,
}: {
  data: RiderCarouselResponse;
  onImageIssue: ImageIssueHandler;
}) {
  const { riders } = data;
  const total = riders.length;
  const [index, setIndex] = useState(0);
  // La pestaña vive aquí y no en la ficha para conservarla al pasar de un piloto a otro (comparar).
  const [tab, setTab] = useState<StatsTabKey>("season");
  const containerRef = useRef<HTMLElement>(null);
  const rider = riders[index];

  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const delta =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!delta || total < 2) return;

    event.preventDefault();
    go(delta);
    // La ficha se vuelve a montar con cada piloto: si el foco estaba dentro, se recoge aquí.
    containerRef.current?.focus({ preventScroll: true });
  }

  return (
    <section
      ref={containerRef}
      tabIndex={0}
      aria-roledescription="carrusel"
      aria-label={`Pilotos de ${data.category}, temporada ${data.season}`}
      onKeyDown={handleKeyDown}
      className={`rounded-[18px] ${FOCUS_RING}`}
    >
      <div className="relative lg:grid lg:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] lg:items-center lg:gap-4">
        <ArrowButton
          direction="prev"
          disabled={total < 2}
          onClick={() => go(-1)}
        />

        <div
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${index + 1} de ${total}`}
        >
          <RiderSlide
            key={rider.id}
            rider={rider}
            season={data.season}
            category={data.category}
            priority={index === 0}
            tab={tab}
            onTabChange={setTab}
            onImageIssue={onImageIssue}
          />
        </div>

        <ArrowButton
          direction="next"
          disabled={total < 2}
          onClick={() => go(1)}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        Piloto {index + 1} de {total}: {rider.full_name}
      </p>

      <div className="mt-6 flex justify-center">
        <span
          aria-hidden="true"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tabular-nums text-zinc-400"
        >
          {index + 1} / {total}
        </span>
      </div>
    </section>
  );
}

export function RiderCarousel({
  status,
  data,
  category,
  onCategoryChange,
  onRetry,
  onImageIssue,
}: RiderCarouselProps) {
  // El padre puede recrear onImageIssue en cada render: se guarda en una ref y cada aviso se envía una sola vez por piloto y motivo.
  const issueRef = useRef(onImageIssue);
  useEffect(() => {
    issueRef.current = onImageIssue;
  });
  const reported = useRef(new Set<string>());
  const reportImageIssue = useCallback<ImageIssueHandler>((rider, reason) => {
    const key = `${rider.id}:${reason}`;
    if (reported.current.has(key)) return;
    reported.current.add(key);
    issueRef.current(rider, reason);
  }, []);

  // Datos de otra categoría (aún no ha llegado la respuesta nueva): se trata como carga.
  const stale = data !== null && data.category !== category;

  let body: React.ReactNode;
  if (status === "error") {
    body = <ErrorState category={category} onRetry={onRetry} />;
  } else if (status === "loading" || !data || stale) {
    body = <CarouselSkeleton />;
  } else if (data.riders.length === 0) {
    body = <EmptyState category={category} season={data.season} />;
  } else {
    body = (
      <Slides
        key={`${data.category}-${data.season}`}
        data={data}
        onImageIssue={reportImageIssue}
      />
    );
  }

  return (
    <div>
      {body}
      <CategorySelector category={category} onChange={onCategoryChange} />
    </div>
  );
}
