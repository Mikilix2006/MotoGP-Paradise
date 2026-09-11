import { prisma } from "@/lib/prisma";

import type { Rider } from "@prisma/client";

/*
 * Identificadores externos que puede traer un piloto según la
 * API de origen:
 *
 *   API de resultados (/results/...):
 *     rider.id               → Rider.motogpUuid
 *     rider.riders_api_uuid  → Rider.ridersApiUuid
 *     rider.riders_id        → Rider.ridersId
 *     rider.legacy_id        → Rider.legacyId
 *
 *   API general (/riders):
 *     id                     → Rider.ridersApiUuid
 *     legacy_id              → Rider.legacyId
 *
 * Las dos APIs NO comparten el uuid principal, y la de
 * resultados llega a usar más de un `id` para el mismo piloto
 * en temporadas distintas. El único identificador estable en
 * ambas es `legacy_id`, así que la identidad se resuelve por
 * ese campo y los uuids se conservan como datos auxiliares.
 */
export interface RiderIdentity {
  legacyId?: number | null;

  /** rider.id de la API de resultados. */
  resultsUuid?: string | null;

  /** id de la API general (riders_api_uuid en resultados). */
  ridersApiUuid?: string | null;

  ridersId?: string | null;
}

export interface RiderAttributes {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: Date | null;
  birthCity?: string | null;
  startYear?: number | null;
  legend?: boolean | null;
  countryId?: string | null;
}

/**
 * Busca un piloto ya importado. El orden importa: primero la
 * clave estable (legacyId) y después los uuids, que solo
 * sirven cuando el piloto no tiene legacy_id en la respuesta.
 */
export async function findRider(
  identity: RiderIdentity
): Promise<Rider | null> {
  if (identity.legacyId !== null && identity.legacyId !== undefined) {
    const byLegacyId = await prisma.rider.findUnique({
      where: {
        legacyId: identity.legacyId,
      },
    });

    if (byLegacyId) {
      return byLegacyId;
    }
  }

  if (identity.ridersApiUuid) {
    const byRidersApiUuid = await prisma.rider.findFirst({
      where: {
        ridersApiUuid: identity.ridersApiUuid,
      },
    });

    if (byRidersApiUuid) {
      return byRidersApiUuid;
    }
  }

  if (identity.resultsUuid) {
    const byResultsUuid = await prisma.rider.findUnique({
      where: {
        motogpUuid: identity.resultsUuid,
      },
    });

    if (byResultsUuid) {
      return byResultsUuid;
    }
  }

  return null;
}

/**
 * Devuelve el piloto correspondiente a la identidad indicada,
 * creándolo si no existe. Nunca crea una segunda fila para un
 * piloto ya conocido por otro uuid.
 *
 * Los identificadores externos solo se rellenan cuando faltan:
 * el primer `rider.id` de resultados que se vio se conserva
 * aunque otra temporada traiga otro distinto. Los atributos
 * (`fullName`, país...) siguen el patrón habitual: el valor
 * disponible sobrescribe, un `null` conserva el existente.
 */
export async function upsertRider(
  identity: RiderIdentity,
  attributes: RiderAttributes
): Promise<{ rider: Rider; created: boolean }> {
  const existing = await findRider(identity);

  const definedAttributes = Object.fromEntries(
    Object.entries(attributes).filter(
      ([, value]) => value !== null && value !== undefined
    )
  ) as Partial<RiderAttributes>;

  if (existing) {
    const rider = await prisma.rider.update({
      where: {
        id: existing.id,
      },

      data: {
        ...definedAttributes,

        legacyId: existing.legacyId ?? identity.legacyId ?? null,

        motogpUuid:
          existing.motogpUuid ?? identity.resultsUuid ?? null,

        ridersApiUuid:
          existing.ridersApiUuid ?? identity.ridersApiUuid ?? null,

        ridersId: existing.ridersId ?? identity.ridersId ?? null,
      },
    });

    return { rider, created: false };
  }

  const rider = await prisma.rider.create({
    data: {
      ...definedAttributes,

      legacyId: identity.legacyId ?? null,
      motogpUuid: identity.resultsUuid ?? null,
      ridersApiUuid: identity.ridersApiUuid ?? null,
      ridersId: identity.ridersId ?? null,
    },
  });

  return { rider, created: true };
}
