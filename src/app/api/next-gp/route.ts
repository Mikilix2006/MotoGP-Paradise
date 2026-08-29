import { NextResponse } from "next/server";

import {
getCurrentGrandPrixData,
} from "@/services/currentGrandPrixService";

import {
getNextMotoGPRace,
} from "@/services/nextMotoGPRaceService";

export async function GET() {
try {
const grandPrix =
await getCurrentGrandPrixData();

const race =
  await getNextMotoGPRace();

if (!grandPrix) {
  return NextResponse.json(
    {
      error:
        "No se encontró ningún Gran Premio actual",
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

return NextResponse.json({
  data: {
    ...grandPrix,

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
