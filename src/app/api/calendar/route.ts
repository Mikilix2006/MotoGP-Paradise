import { NextResponse } from "next/server";

import {
  getSeasonEvents,
} from "@/services/db/nextGrandPrixRepository";

export const revalidate = 60;

export async function GET() {
  try {
    const events = await getSeasonEvents();

    return NextResponse.json({
      data: events,
    });
  } catch (error) {
    console.error(
      "Error obteniendo el calendario:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo obtener la información del calendario",
      },
      {
        status: 500,
      }
    );
  }
}
