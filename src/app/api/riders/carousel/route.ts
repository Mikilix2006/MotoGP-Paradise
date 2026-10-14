import { NextResponse } from "next/server";

import { getRiderCarousel } from "@/services/db/riderCarouselRepository";

import type { CarouselCategory } from "@/types/riderCarousel";

/*
 * Los datos solo cambian cuando se ejecutan los importadores. La ruta lee la
 * URL de la petición, así que `next build` la marca como dinámica (ƒ) y no se
 * cachea (por eso no lleva `revalidate`): cada petición hace unas 7 consultas
 * agrupadas (~100 ms).
 */

const CATEGORIES: readonly CarouselCategory[] = ["MotoGP", "Moto2", "Moto3"];

export async function GET(request: Request) {
  const category =
    new URL(request.url).searchParams.get("category") ?? "MotoGP";

  if (!CATEGORIES.includes(category as CarouselCategory)) {
    return NextResponse.json(
      {
        error: "Categoría no válida. Usa MotoGP, Moto2 o Moto3",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const carousel = await getRiderCarousel(category as CarouselCategory);

    if (!carousel) {
      return NextResponse.json(
        {
          error: "No hay pilotos de esta categoría en la temporada actual",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      data: carousel,
    });
  } catch (error) {
    console.error("Error obteniendo los pilotos del carrusel:", error);

    return NextResponse.json(
      {
        error: "No se pudieron obtener los pilotos",
      },
      {
        status: 500,
      }
    );
  }
}
