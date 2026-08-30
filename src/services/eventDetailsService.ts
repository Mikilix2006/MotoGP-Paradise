import { motogpFetch } from "@/services/motogpApi";

export interface CircuitTrackDetails {
  eventUuid: string;
  lengthKm: number | null;
  totalCorners: number | null;
  laps: number | null;
}

interface Track {
  id?: string;

  lenght?: string | number;

  lenght_units?: {
    kiloMeters?: number;
  };

  left_corners?: string | number;

  right_corners?: string | number;
}

interface EventCategory {
  category_id?: string;

  category_timing_id?: number;

  timing_id?: number;

  sequence?: number;

  num_laps?: number | null;

  sprint_num_laps?: number | null;

  distance?: {
    meters?: number;
    kiloMeters?: number;
    miles?: number;
    feet?: number;
  };
}

interface MotoGPEventDetails {
  id: string;

  circuit?: {
    id?: string;
    name?: string;

    /*
     * En algunos eventos la información del
     * circuito puede estar anidada aquí.
     */
    track?: Track;
  };

  /*
   * En otros casos puede estar directamente
   * en el evento.
   */
  track?: Track;

  event_categories?: EventCategory[];
}

function normalizeText(value?: string): string {
  return value
    ?.trim()
    .toLowerCase() ?? "";
}

function getTrackFromEvent(
  event: MotoGPEventDetails
): Track | undefined {
  /*
   * Primera posibilidad:
   * event.track
   */
  if (event.track) {
    return event.track;
  }

  /*
   * Segunda posibilidad:
   * event.circuit.track
   */
  if (event.circuit?.track) {
    return event.circuit.track;
  }

  return undefined;
}

function getMotoGPLaps(
  event: MotoGPEventDetails
): number | null {
  if (!event.event_categories) {
    return null;
  }

  /*
   * MotoGP tiene category_timing_id = 3.
   *
   * Este valor aparece directamente en
   * event_categories.
   */
  const motoGPEventCategory =
    event.event_categories.find(
      (item) =>
        item.category_timing_id === 3
    );

  if (!motoGPEventCategory) {
    console.warn(
      "No se encontró MotoGP en event_categories:",
      event.event_categories
    );

    return null;
  }

  return motoGPEventCategory.num_laps ?? null;
}

export async function getCircuitTrackDetails(
  seasonYear: number,
  circuitId: string,
  circuitName: string
): Promise<CircuitTrackDetails | null> {
  const events =
    await motogpFetch<MotoGPEventDetails[]>(
      `/events?seasonYear=${seasonYear}`
    );

  /*
   * 1. Buscar primero por ID del circuito.
   */
  let event = events.find(
    (item) =>
      item.circuit?.id === circuitId
  );

  /*
   * 2. Si los IDs no coinciden entre los
   * endpoints, buscamos por nombre.
   */
  if (!event) {
    const normalizedCircuitName =
      normalizeText(circuitName);

    event = events.find(
      (item) =>
        normalizeText(
          item.circuit?.name
        ) === normalizedCircuitName
    );
  }

  if (!event) {
    console.warn(
      "No se encontró el evento para el circuito:",
      {
        circuitId,
        circuitName,
        seasonYear,
      }
    );

    return null;
  }

  const track =
    getTrackFromEvent(event);

  /*
   * Longitud.
   */
  const lengthKm =
    track?.lenght_units?.kiloMeters ??
    null;

  /*
   * Curvas izquierdas y derechas.
   */
  const leftCorners =
    track?.left_corners !== undefined &&
    track.left_corners !== ""
      ? Number(track.left_corners)
      : null;

  const rightCorners =
    track?.right_corners !== undefined &&
    track.right_corners !== ""
      ? Number(track.right_corners)
      : null;

  /*
   * Curvas totales.
   */
  const totalCorners =
    leftCorners !== null &&
    rightCorners !== null
      ? leftCorners + rightCorners
      : null;

  /*
   * Vueltas de la carrera principal MotoGP.
   */
const laps =
  getMotoGPLaps(event);

  console.log(
    "Datos del circuito encontrados:",
    {
      eventUuid: event.id,
      track,
      lengthKm,
      leftCorners,
      rightCorners,
      totalCorners,
      laps,
    }
  );

  return {
    eventUuid: event.id,
    lengthKm,
    totalCorners,
    laps,
  };
}