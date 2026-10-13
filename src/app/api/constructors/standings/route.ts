import { NextResponse } from "next/server";

import {
  getMotoGPConstructorStandings,
} from "@/services/db/constructorStandingsRepository";

/* Los datos solo cambian al ejecutarse los importadores: caché de un minuto. */
export const revalidate = 60;

export async function GET() {
  try {
    const constructors = await getMotoGPConstructorStandings();

    return NextResponse.json({ data: constructors });
  } catch (error) {
    console.error(
      "Error obteniendo la clasificación de constructores:",
      error
    );

    return NextResponse.json(
      { error: "No se pudo obtener la clasificación de constructores" },
      { status: 500 }
    );
  }
}
