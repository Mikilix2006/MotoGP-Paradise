import { NextResponse } from "next/server";

import { getResults } from "@/services/db/resultsRepository";

/*
 * Lee la URL de la petición, así que es dinámica y no lleva `revalidate`
 * (las consultas son ligeras: filtran por año y sección). Los parámetros
 * inválidos se descartan en lugar de dar error: caen al valor por defecto.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const year = /^\d{4}$/.test(params.get("year") ?? "") ? Number(params.get("year")) : undefined;
  const category = /^-?\d{1,3}$/.test(params.get("category") ?? "") ? Number(params.get("category")) : undefined;
  const event = params.get("event");
  const session = params.get("session");

  try {
    const data = await getResults({
      section: params.get("section") === "tests" ? "tests" : "season",
      year,
      category,
      event: event && event.length <= 64 ? event : undefined,
      session: session && session.length <= 12 ? session : undefined,
    });

    if (!data) {
      return NextResponse.json({ error: "No hay resultados disponibles" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error obteniendo los resultados:", error);

    return NextResponse.json({ error: "No se pudieron obtener los resultados" }, { status: 500 });
  }
}
