import { NextResponse } from "next/server";

import {
  getMotoGPRiderStandings,
} from "@/services/riderService";

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