import { NextResponse } from "next/server";

import {
  getNextGrandPrixFavorites,
} from "@/services/db/favoritesRepository";

/*
 * El índice solo cambia cuando se importan resultados nuevos.
 */
export const revalidate = 300;

export async function GET() {
  try {
    const favorites = await getNextGrandPrixFavorites();

    if (!favorites) {
      return NextResponse.json(
        {
          error:
            "No hay datos suficientes para calcular los favoritos del próximo GP",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      data: favorites,
    });
  } catch (error) {
    console.error(
      "Error calculando los favoritos del próximo GP:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron calcular los favoritos del próximo GP",
      },
      {
        status: 500,
      }
    );
  }
}
