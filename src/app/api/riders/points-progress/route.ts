import { NextResponse } from "next/server";

import { getPointsProgress } from "@/services/db/pointsProgressRepository";

/*
 * Los datos cambian solo cuando se ejecutan los importadores. Como la ruta
 * lee la URL, Next la trata como dinámica y este valor solo aplica si se
 * llegara a prerrenderizar; se deja por coherencia con standings.
 * Los demás métodos devuelven 405 automáticamente (solo se exporta GET).
 */
export const revalidate = 60;

/** Categorías con puntos por carrera: 1 = Moto3, 2 = Moto2, 3 = MotoGP. */
const CATEGORIES = [1, 2, 3];
/*
 * Rango admitido (1949..actual+1) más amplio que el de la UI (2014+): antes de
 * 2014 faltan carreras en la BD y los datos no son fiables, pero la API no lo impide.
 */
const MIN_YEAR = 1949;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawYear = params.get("year");
  const rawCategory = params.get("category");

  // Sin parámetro: temporada actual y MotoGP. Con parámetro inválido: 400.
  const year = rawYear === null ? undefined : Number(rawYear);
  const category = rawCategory === null ? 3 : Number(rawCategory);

  if (
    year !== undefined &&
    (!/^\d{4}$/.test(rawYear ?? "") || year < MIN_YEAR || year > new Date().getFullYear() + 1)
  ) {
    return NextResponse.json({ error: "El año no es válido" }, { status: 400 });
  }

  if (!/^\d{1,3}$/.test(rawCategory ?? "3") || !CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: "La categoría no es válida (1 = Moto3, 2 = Moto2, 3 = MotoGP)" },
      { status: 400 }
    );
  }

  try {
    const data = await getPointsProgress(year, category);

    if (!data) {
      return NextResponse.json(
        { error: "No hay datos para esa temporada y categoría" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error obteniendo la evolución de puntos:", error);

    return NextResponse.json(
      { error: "No se pudo obtener la evolución de puntos" },
      { status: 500 }
    );
  }
}
