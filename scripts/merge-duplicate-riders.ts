import { prisma } from "../src/lib/prisma";

import type { Prisma, Rider } from "@prisma/client";

/*
 * ============================================================
 * FUSIÓN DE PILOTOS DUPLICADOS
 * ============================================================
 *
 * Hasta que existió riderResolver.ts cada importador hacía
 * upsert por motogpUuid con el uuid de su propia API, así que
 * el mismo piloto acabó con dos filas en `riders`:
 *
 *   - una creada por /results (motogpUuid = rider.id de
 *     resultados, con ridersApiUuid y ridersId);
 *   - otra creada por /riders (motogpUuid = id de la API
 *     general, con nombre, apellidos, fecha de nacimiento...).
 *
 * Y en algún caso dos filas de resultados con distinto
 * rider.id para el mismo legacy_id.
 *
 * Este script deja una sola fila por legacy_id: conserva la de
 * resultados (o la más referenciada), le copia los datos que
 * le faltan y le reasigna todas las relaciones de las otras.
 *
 * Es necesario ejecutarlo antes de aplicar la migración que
 * hace único Rider.legacyId. Es idempotente: si no hay
 * duplicados no toca nada.
 *
 *   npx tsx scripts/merge-duplicate-riders.ts
 */

type RiderWithCounts = Rider & {
  _count: {
    seasonEntries: number;
    statistics: number;
    sessionResults: number;
    championshipStandings: number;
    bmwAwardStandings: number;
    liveTiming: number;
  };
};

function countReferences(rider: RiderWithCounts): number {
  return Object.values(rider._count).reduce(
    (total, value) => total + value,
    0
  );
}

/**
 * La fila canónica es la que tiene identificadores de la API
 * de resultados; a igualdad, la más referenciada y después la
 * más antigua.
 */
function pickCanonical(riders: RiderWithCounts[]): RiderWithCounts {
  return [...riders].sort((a, b) => {
    const aResults = a.ridersApiUuid !== null ? 1 : 0;
    const bResults = b.ridersApiUuid !== null ? 1 : 0;

    if (aResults !== bResults) {
      return bResults - aResults;
    }

    const references = countReferences(b) - countReferences(a);

    if (references !== 0) {
      return references;
    }

    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

/**
 * Identificador de la API general del duplicado: si la fila
 * vino de /riders su motogpUuid es en realidad ese id.
 */
function ridersApiUuidOf(rider: Rider): string | null {
  if (rider.ridersApiUuid) {
    return rider.ridersApiUuid;
  }

  const cameFromRidersApi =
    rider.firstName !== null || rider.lastName !== null;

  return cameFromRidersApi ? rider.motogpUuid : null;
}

async function mergeInto(
  tx: Prisma.TransactionClient,
  canonical: Rider,
  duplicate: Rider
): Promise<void> {
  /*
   * 1. Completar la fila canónica con lo que solo tenga el
   *    duplicado. Nunca se sobrescribe un valor existente.
   */
  await tx.rider.update({
    where: {
      id: canonical.id,
    },

    data: {
      ridersApiUuid:
        canonical.ridersApiUuid ?? ridersApiUuidOf(duplicate),
      ridersId: canonical.ridersId ?? duplicate.ridersId,
      fullName: canonical.fullName ?? duplicate.fullName,
      firstName: canonical.firstName ?? duplicate.firstName,
      lastName: canonical.lastName ?? duplicate.lastName,
      birthDate: canonical.birthDate ?? duplicate.birthDate,
      birthCity: canonical.birthCity ?? duplicate.birthCity,
      startYear: canonical.startYear ?? duplicate.startYear,
      legend: canonical.legend || duplicate.legend,
      countryId: canonical.countryId ?? duplicate.countryId,
    },
  });

  /*
   * 2. Reasignar relaciones. Donde hay restricción única que
   *    incluye riderId, las filas del duplicado que chocarían
   *    con una ya existente en la canónica se eliminan: son la
   *    misma información importada dos veces.
   *
   *    `constructor: false` en los select evita el choque de
   *    tipos con Object.prototype.constructor, porque estos
   *    modelos tienen una relación llamada así.
   */
  const canonicalEntries = await tx.riderSeasonEntry.findMany({
    where: { riderId: canonical.id },
    select: { seasonId: true, categoryId: true, constructor: false },
  });

  await tx.riderSeasonEntry.deleteMany({
    where: {
      riderId: duplicate.id,
      OR: canonicalEntries.length
        ? canonicalEntries
        : [{ id: "__none__" }],
    },
  });

  await tx.riderSeasonEntry.updateMany({
    where: { riderId: duplicate.id },
    data: { riderId: canonical.id },
  });

  const canonicalStatistics = await tx.riderSeasonStatistics.findMany({
    where: { riderId: canonical.id },
    select: { seasonId: true, categoryId: true, constructor: false },
  });

  await tx.riderSeasonStatistics.deleteMany({
    where: {
      riderId: duplicate.id,
      OR: canonicalStatistics.length
        ? canonicalStatistics
        : [{ id: "__none__" }],
    },
  });

  await tx.riderSeasonStatistics.updateMany({
    where: { riderId: duplicate.id },
    data: { riderId: canonical.id },
  });

  const canonicalResults = await tx.sessionResult.findMany({
    where: { riderId: canonical.id },
    select: { sessionId: true, constructor: false },
  });

  await tx.sessionResult.deleteMany({
    where: {
      riderId: duplicate.id,
      sessionId: {
        in: canonicalResults.map((result) => result.sessionId),
      },
    },
  });

  await tx.sessionResult.updateMany({
    where: { riderId: duplicate.id },
    data: { riderId: canonical.id },
  });

  const canonicalStandings = await tx.championshipStanding.findMany({
    where: { riderId: canonical.id },
    select: { seasonId: true, categoryId: true, constructor: false },
  });

  await tx.championshipStanding.deleteMany({
    where: {
      riderId: duplicate.id,
      OR: canonicalStandings.length
        ? canonicalStandings
        : [{ id: "__none__" }],
    },
  });

  await tx.championshipStanding.updateMany({
    where: { riderId: duplicate.id },
    data: { riderId: canonical.id },
  });

  const canonicalBmw = await tx.bmwAwardStanding.findMany({
    where: { riderId: canonical.id },
    select: { seasonId: true, constructor: false },
  });

  await tx.bmwAwardStanding.deleteMany({
    where: {
      riderId: duplicate.id,
      seasonId: {
        in: canonicalBmw.map((standing) => standing.seasonId),
      },
    },
  });

  await tx.bmwAwardStanding.updateMany({
    where: { riderId: duplicate.id },
    data: { riderId: canonical.id },
  });

  await tx.liveRiderTiming.updateMany({
    where: { riderId: duplicate.id },
    data: { riderId: canonical.id },
  });

  /*
   * 3. Eliminar el duplicado, ya sin relaciones.
   */
  await tx.rider.delete({
    where: {
      id: duplicate.id,
    },
  });
}

async function main() {
  console.log("🔀 Buscando pilotos duplicados por legacy_id...");

  const groups = await prisma.rider.groupBy({
    by: ["legacyId"],

    where: {
      legacyId: {
        not: null,
      },
    },

    having: {
      legacyId: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Pilotos con más de una fila: ${groups.length}`);

  let merged = 0;

  for (const group of groups) {
    const riders = await prisma.rider.findMany({
      where: {
        legacyId: group.legacyId,
      },

      include: {
        _count: {
          select: {
            seasonEntries: true,
            statistics: true,
            sessionResults: true,
            championshipStandings: true,
            bmwAwardStandings: true,
            liveTiming: true,
          },
        },
      },
    });

    const canonical = pickCanonical(riders);

    const duplicates = riders.filter(
      (rider) => rider.id !== canonical.id
    );

    await prisma.$transaction(async (tx) => {
      for (const duplicate of duplicates) {
        /*
         * Se relee la canónica en cada vuelta para que los
         * campos completados por un duplicado no se pisen con
         * los del siguiente.
         */
        const current = await tx.rider.findUniqueOrThrow({
          where: {
            id: canonical.id,
          },
        });

        await mergeInto(tx, current, duplicate);
      }
    });

    merged += duplicates.length;

    console.log(
      `✅ ${canonical.fullName ?? canonical.id} (${group.legacyId}): ${duplicates.length} fila(s) fusionada(s)`
    );
  }

  console.log("\n=================================");
  console.log("🔀 FUSIÓN COMPLETADA");
  console.log("=================================\n");

  console.log(`Pilotos revisados: ${groups.length}`);
  console.log(`Filas eliminadas: ${merged}`);
}

main()
  .catch((error) => {
    console.error("\n❌ Error fusionando pilotos:");
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
