import { motogpFetch } from "@/services/motogpApi";

export interface CircuitTrackDetails {
  eventUuid: string;
  lengthKm: number | null;
  totalCorners: number | null;
  laps: number | null;
  infoImageUrl: string | null;
}

interface Track {
  id?: string;

  lenght_units?: {
    kiloMeters?: number;
  };

  left_corners?: string | number;

  right_corners?: string | number;

  is_active?: boolean;

  assets?: {
    info?: {
      id?: string;
      name?: string;
      type?: string;
      path?: string;
      mimetype?: string;
    };
  };
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

    tracks?: Track[];
  };

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
  // El track principal del evento
  if (event.track) {
    return event.track;
  }

  // Buscar primero el track activo dentro del circuito
  const activeTrack =
    event.circuit?.tracks?.find(
      (track) => track.is_active === true
    );

  if (activeTrack) {
    return activeTrack;
  }

  // Como último recurso, usar el primer track disponible
  return event.circuit?.tracks?.[0];
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

  /*
   * Vueltas de la carrera principal MotoGP.
   */
const laps =
  getMotoGPLaps(event);

  const track = getTrackFromEvent(event);

  if (!track) {
    return {
      eventUuid: event.id,
      lengthKm: null,
      totalCorners: null,
      laps,
      infoImageUrl: null,
    };
  }

  const infoImageUrl =
  track?.assets?.info?.path ??
  null;

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
    track.right_corners !== undefined &&
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

    infoImageUrl,
  };
}