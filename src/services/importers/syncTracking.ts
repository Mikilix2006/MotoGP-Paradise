import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

import type { ApiSource } from "@prisma/client";

export interface SyncStats {
  processed?: number;
  created?: number;
  updated?: number;
}

interface TrackSyncRunOptions<T> {
  source: ApiSource;
  endpoint: string;

  /*
   * Permite extraer los contadores desde el
   * resultado del importador, que tiene una
   * forma distinta en cada caso.
   */
  getStats?: (result: T) => SyncStats;
}

/**
 * Envuelve la ejecución de un importador y deja
 * constancia de ella en SyncRun.
 *
 * Registra inicio, fin, estado y contadores, de forma
 * que se pueda saber qué se importó y si falló.
 */
export async function trackSyncRun<T>(
  options: TrackSyncRunOptions<T>,
  run: () => Promise<T>
): Promise<T> {
  const syncRun = await prisma.syncRun.create({
    data: {
      source: options.source,
      endpoint: options.endpoint,
    },
  });

  try {
    const result = await run();

    const stats =
      options.getStats?.(result) ?? {};

    await prisma.syncRun.update({
      where: {
        id: syncRun.id,
      },

      data: {
        status: "SUCCESS",
        finishedAt: new Date(),

        recordsProcessed: stats.processed ?? 0,
        recordsCreated: stats.created ?? 0,
        recordsUpdated: stats.updated ?? 0,
      },
    });

    return result;
  } catch (error) {
    await prisma.syncRun.update({
      where: {
        id: syncRun.id,
      },

      data: {
        status: "FAILED",
        finishedAt: new Date(),

        errorMessage:
          error instanceof Error
            ? error.message
            : String(error),
      },
    });

    throw error;
  }
}

interface SaveApiSnapshotOptions {
  source: ApiSource;
  endpoint: string;

  requestParameters?: Record<string, string | number | boolean | null>;

  entityType?: string;
  entityExternalId?: string;

  payload: unknown;
}

/*
 * Campos que cambian en cada petición sin que cambien los datos.
 *
 * "remain" es una cuenta atrás en milisegundos: si se tiene en
 * cuenta, cada snapshot sería distinto del anterior y la tabla
 * crecería en cada ejecución sin aportar nada.
 */
const VOLATILE_FIELDS = new Set(["remain"]);

function stripVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripVolatileFields);
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(
      value as Record<string, unknown>
    )
      .filter(([key]) => !VOLATILE_FIELDS.has(key))
      .map(([key, item]) => [
        key,
        stripVolatileFields(item),
      ]);

    return Object.fromEntries(entries);
  }

  return value;
}

/**
 * Guarda la respuesta original de un endpoint.
 *
 * Solo se utiliza con endpoints de listado (temporada,
 * evento, clasificación general). Guardar cada respuesta
 * individual haría crecer la tabla sin aportar valor.
 *
 * Si el payload no ha cambiado respecto al último snapshot
 * del mismo endpoint, no se vuelve a guardar.
 */
export async function saveApiSnapshot(
  options: SaveApiSnapshotOptions
): Promise<void> {
  const serialized = JSON.stringify(
    options.payload ?? null
  );

  /*
   * El hash se calcula sin los campos volátiles, pero se guarda
   * la respuesta tal cual llegó.
   */
  const payloadHash = createHash("sha256")
    .update(
      JSON.stringify(
        stripVolatileFields(options.payload ?? null)
      )
    )
    .digest("hex");

  const lastSnapshot =
    await prisma.apiSnapshot.findFirst({
      where: {
        source: options.source,
        endpoint: options.endpoint,
        entityExternalId:
          options.entityExternalId ?? null,
      },

      orderBy: {
        fetchedAt: "desc",
      },
    });

  if (lastSnapshot?.payloadHash === payloadHash) {
    return;
  }

  await prisma.apiSnapshot.create({
    data: {
      source: options.source,
      endpoint: options.endpoint,

      requestParameters:
        options.requestParameters ?? undefined,

      entityType: options.entityType ?? null,
      entityExternalId:
        options.entityExternalId ?? null,

      payload: JSON.parse(serialized),
      payloadHash,
    },
  });
}
