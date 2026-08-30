import { NextResponse } from "next/server";

import {
  getCurrentGrandPrixData,
} from "@/services/currentGrandPrixService";

import {
  getNextMotoGPRace,
} from "@/services/nextMotoGPRaceService";

import {
  getCurrentSeason,
} from "@/services/seasonService";

import {
  getCircuitTrackDetails,
} from "@/services/eventDetailsService";

export async function GET() {
  try {
    const [
      season,
      grandPrix,
      race,
    ] = await Promise.all([
      getCurrentSeason(),
      getCurrentGrandPrixData(),
      getNextMotoGPRace(),
    ]);

    if (!season) {
      return NextResponse.json(
        {
          error:
            "No se encontró la temporada actual",
        },
        {
          status: 404,
        }
      );
    }

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

    if (!race) {
      return NextResponse.json(
        {
          error:
            "No se encontró la carrera principal de MotoGP",
        },
        {
          status: 404,
        }
      );
    }

    let circuitTrack = null;

    try {
      circuitTrack =
        await getCircuitTrackDetails(
          season.year,
          grandPrix.circuit.id,
          grandPrix.circuit.name
        );
    } catch (error) {
      console.error(
        "Error obteniendo datos del circuito:",
        error
      );
    }

    return NextResponse.json({
      data: {
        ...grandPrix,

        circuit: {
          ...grandPrix.circuit,

          track: circuitTrack,
        },

        nextMotoGPRace:
          race.nextMotoGPRace,

        race: {
          seasonUuid:
            race.seasonUuid,

          eventUuid:
            race.eventUuid,

          categoryUuid:
            race.categoryUuid,

          sessionUuid:
            race.sessionUuid,
        },
      },
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