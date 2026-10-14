"use client";

import { useCallback, useEffect, useState, type ComponentProps } from "react";

import { RiderCarousel } from "@/components/riders/RiderCarousel";

import type {
  CarouselCategory,
  RiderCarouselResponse,
} from "@/types/riderCarousel";

type ImageIssueHandler = ComponentProps<typeof RiderCarousel>["onImageIssue"];

type Result =
  | { key: string; status: "ready"; data: RiderCarouselResponse }
  | { key: string; status: "error"; data: null };

export default function RidersPage() {
  const [category, setCategory] = useState<CarouselCategory>("MotoGP");

  // Cada reintento cambia la clave y vuelve a pedir los datos.
  const [attempt, setAttempt] = useState(0);

  const [result, setResult] = useState<Result | null>(null);

  const key = `${category}:${attempt}`;

  // Mientras no haya respuesta para la clave actual (cambio de categoría o reintento) se está cargando.
  const current = result?.key === key ? result : null;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/riders/carousel?category=${category}`,
          { signal: controller.signal }
        );

        const json = await response.json();

        if (!response.ok || !json.data) {
          throw new Error(json.error ?? "Respuesta no válida");
        }

        setResult({ key, status: "ready", data: json.data });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Error cargando los pilotos:", error);

        setResult({ key, status: "error", data: null });
      }
    }

    load();

    return () => controller.abort();
  }, [category, key]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // Solo desarrollo: la ruta responde 404 en producción, así que ni se llama.
  const reportImageIssue = useCallback<ImageIssueHandler>((rider, reason) => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    fetch("/api/dev/image-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rider_id: rider.id,
        full_name: rider.full_name,
        image_url: rider.image_url,
        reason,
      }),
    }).catch(() => {});
  }, []);

  return (
    <RiderCarousel
      status={current?.status ?? "loading"}
      data={current?.data ?? null}
      category={category}
      onCategoryChange={setCategory}
      onRetry={retry}
      onImageIssue={reportImageIssue}
    />
  );
}
