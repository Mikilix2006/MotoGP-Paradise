import { NextResponse } from "next/server";

import {
  getNextGrandPrix,
} from "@/services/db/nextGrandPrixRepository";

/*
 * Los datos cambian solo cuando se ejecutan los importadores,
 * así que la respuesta se puede cachear un minuto como hacía
 * antes el cliente de la API externa.
 */
export const revalidate = 60;

export async function GET() {
  try {
    const grandPrix = await getNextGrandPrix();

    if (!grandPrix) {
      return NextResponse.json(
        {
          error:
            "No se encontró ningún Gran Premio actual o próximo",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      data: grandPrix,
    });
  } catch (error) {
    console.error(
      "Error obteniendo el próximo GP:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo obtener la información del próximo GP",
      },
      {
        status: 500,
      }
    );
  }
}
