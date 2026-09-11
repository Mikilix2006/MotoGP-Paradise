import { NextResponse } from "next/server";

import {
  getMotoGPRiderStandings,
} from "@/services/db/riderStandingsRepository";

/*
 * Los datos cambian solo cuando se ejecutan los importadores,
 * así que la respuesta se puede cachear un minuto como hacía
 * antes el cliente de la API externa.
 */
export const revalidate = 60;

export async function GET() {
  try {
    const riders =
      await getMotoGPRiderStandings();

    return NextResponse.json({
      data: riders,
    });

  } catch (error) {
    console.error(
      "Error obteniendo la clasificación de pilotos:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo obtener la clasificación de pilotos",
      },
      {
        status: 500,
      }
    );
  }
}