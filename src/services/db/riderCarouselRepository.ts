import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

import { htmlToPlainText } from "@/utils/text";

import type {
  CarouselCategory,
  RiderCarouselItem,
  RiderCarouselResponse,
  RiderTitle,
  RiderTrajectoryStep,
} from "@/types/riderCarousel";
import { countryNameEs } from "@/utils/country";

const CATEGORY_LEGACY_IDS: Record<CarouselCategory, number> = {
  MotoGP: 3,
  Moto2: 2,
  Moto3: 1,
};

const MOTOGP_LEGACY_ID = 3;
const CATEGORY_500CC_LEGACY_ID = -1;

// Mismo host que `images.remotePatterns` en next.config.ts.
const IMAGE_URL_PREFIX = "https://photos.motogp.com/";

/* Orden de las categorías dentro de un mismo año en la trayectoria (menor a mayor). */
const CLASS_RANK: Record<number, number> = {
  8: 0, // 50cc
  7: 1, // 80cc
  10: 2, // 125cc
  1: 2, // Moto3
  5: 3, // 250cc
  2: 3, // Moto2
  9: 4, // 350cc
  [CATEGORY_500CC_LEGACY_ID]: 5, // 500cc
  [MOTOGP_LEGACY_ID]: 5, // MotoGP
};

interface SprintWins {
  total: number;
  currentSeason: number;
}

/**
 * Pilotos titulares de una categoría en la temporada actual, con todo lo que
 * muestra el carrusel. Lanza si no hay temporada actual y devuelve null si no
 * existe la categoría; sin pilotos devuelve `riders: []`.
 *
 * Las consultas se agrupan para todos los pilotos a la vez (sin N+1). Las
 * relaciones `constructor` no se incluyen (choque de tipos y fechas): se guarda
 * `constructorId` y el nombre se resuelve con un mapa aparte.
 */
export async function getRiderCarousel(
  carouselCategory: CarouselCategory
): Promise<RiderCarouselResponse | null> {
  const season = await getCurrentSeason();

  if (!season) {
    throw new Error("No se encontró la temporada actual");
  }

  const category = await prisma.category.findFirst({
    where: { legacyId: CATEGORY_LEGACY_IDS[carouselCategory] },
    select: { id: true },
  });

  if (!category) {
    return null;
  }

  const isMotoGP = carouselCategory === "MotoGP";

  const entries = await prisma.riderSeasonEntry.findMany({
    where: {
      seasonId: season.id,
      categoryId: category.id,
      type: "Official",
    },

    select: {
      riderId: true,
      number: true,
      constructorId: true,
      constructor: false,

      team: { select: { name: true, color: true, textColor: true } },

      // PORTRAIT no sirve: no existe en 2026 y sus URL antiguas dan 404.
      images: { where: { type: "PROFILE" }, select: { mainUrl: true } },

      rider: {
        select: {
          id: true,
          motogpUuid: true,
          legacyId: true,
          fullName: true,
          birthDate: true,
          birthCity: true,

          country: { select: { iso: true, name: true, flagUrl: true } },
        },
      },
    },
  });

  // Temporada nueva sin pilotos importados: no es un error, el carrusel muestra su estado vacío.
  if (entries.length === 0) {
    return { season: season.year, category: carouselCategory, riders: [] };
  }

  const riderIds = entries.map((entry) => entry.riderId);

  const [
    constructors,
    biographies,
    standings,
    statistics,
    trajectoryEntries,
    sprintWins,
  ] = await Promise.all([
    // Sin `select`: en el modelo Constructor, Prisma tipa el select con ExtArgs["result"]["constructor"] (= Function) y tsc lo rechaza.
    prisma.constructor.findMany(),

    prisma.riderBiography.findMany({
      where: { riderId: { in: riderIds }, language: "es" },
      select: { riderId: true, text: true },
    }),

    prisma.championshipStanding.findMany({
      where: {
        seasonId: season.id,
        categoryId: category.id,
        riderId: { in: riderIds },
      },
      select: { riderId: true, position: true, points: true, constructor: false },
    }),

    // Toda la carrera: de aquí salen totales, títulos y victorias por categoría.
    prisma.riderSeasonStatistics.findMany({
      where: { riderId: { in: riderIds } },

      select: {
        riderId: true,
        seasonId: true,
        categoryId: true,
        constructorId: true,
        constructor: false,
        starts: true,
        wins: true,
        podiums: true,
        poles: true,
        points: true,
        championshipPosition: true,

        season: { select: { year: true } },
        category: { select: { legacyId: true, name: true } },
      },
    }),

    prisma.riderSeasonEntry.findMany({
      where: { riderId: { in: riderIds } },

      select: {
        riderId: true,
        seasonId: true,
        categoryId: true,
        number: true,
        constructorId: true,
        constructor: false,

        team: { select: { name: true } },
        season: { select: { year: true } },
        category: { select: { legacyId: true, name: true } },
      },
    }),

    isMotoGP
      ? loadSprintWins(riderIds, season.id)
      : Promise.resolve(new Map<string, SprintWins>()),
  ]);

  const constructorNames = new Map(
    constructors.map((constructor) => [constructor.id, constructor.name])
  );

  const constructorName = (id: string | null | undefined) =>
    id ? (constructorNames.get(id) ?? null) : null;

  const biographyByRider = new Map(
    biographies.map((biography) => [biography.riderId, biography.text])
  );

  const standingByRider = new Map(
    standings.map((standing) => [standing.riderId, standing])
  );

  const groupByRider = <T extends { riderId: string }>(rows: T[]) => {
    const groups = new Map<string, T[]>();

    for (const row of rows) {
      const group = groups.get(row.riderId) ?? [];

      group.push(row);

      groups.set(row.riderId, group);
    }

    return groups;
  };

  const statisticsByRider = groupByRider(statistics);
  const trajectoryByRider = groupByRider(trajectoryEntries);

  const riders: RiderCarouselItem[] = entries.map((entry) => {
    const { rider } = entry;

    const stats = statisticsByRider.get(rider.id) ?? [];
    const standing = standingByRider.get(rider.id);
    const sprints = sprintWins.get(rider.id);

    const sum = (
      field: "starts" | "wins" | "podiums" | "poles",
      accept: (row: (typeof stats)[number]) => boolean = () => true
    ) =>
      stats.reduce(
        (total, row) => (accept(row) ? total + (row[field] ?? 0) : total),
        0
      );

    const currentStats = stats.find(
      (row) => row.seasonId === season.id && row.categoryId === category.id
    );

    const position =
      standing?.position ?? currentStats?.championshipPosition ?? null;

    const points =
      standing?.points?.toNumber() ?? currentStats?.points ?? null;

    const hasSeasonData = Boolean(standing || currentStats);

    // La temporada en curso no cuenta: su position = 1 es provisional.
    const titlesByCategory = new Map<string, number[]>();

    stats
      .filter(
        (row) => row.championshipPosition === 1 && row.seasonId !== season.id
      )
      .sort((a, b) => a.season.year - b.season.year)
      .forEach((row) => {
        const years = titlesByCategory.get(row.category.name) ?? [];

        years.push(row.season.year);

        titlesByCategory.set(row.category.name, years);
      });

    const titles: RiderTitle[] = [...titlesByCategory].map(
      ([name, years]) => ({ category: name, years })
    );

    const statisticsConstructor = new Map(
      stats.map((row) => [
        `${row.seasonId}|${row.categoryId}`,
        constructorName(row.constructorId),
      ])
    );

    const trajectory: RiderTrajectoryStep[] = (
      trajectoryByRider.get(rider.id) ?? []
    )
      .sort(
        (a, b) =>
          a.season.year - b.season.year ||
          (CLASS_RANK[a.category.legacyId ?? 99] ?? 99) -
            (CLASS_RANK[b.category.legacyId ?? 99] ?? 99)
      )
      .map((step) => ({
        year: step.season.year,
        category: step.category.name,
        team_name: step.team?.name ?? null,
        constructor_name:
          statisticsConstructor.get(`${step.seasonId}|${step.categoryId}`) ??
          constructorName(step.constructorId),
        // Algunos pasos históricos traen dorsal 0 (27 filas en BD): no es un dorsal real, se trata como "sin dato".
        number: step.number || null,
      }));

    return {
      id: rider.motogpUuid ?? rider.id,
      legacy_id: rider.legacyId,
      full_name: (rider.fullName ?? "").replace(/\s+/g, " ").trim(),
      number: entry.number || null,

      country: rider.country
        ? {
            iso: rider.country.iso,
            name: countryNameEs(rider.country.iso, rider.country.name),
            flag_url: rider.country.flagUrl,
          }
        : null,

      team: entry.team
        ? {
            name: entry.team.name,
            color: entry.team.color,
            text_color: entry.team.textColor,
          }
        : null,

      constructor_name:
        constructorName(currentStats?.constructorId) ??
        constructorName(entry.constructorId),

      birth_date: rider.birthDate?.toISOString().slice(0, 10) ?? null,
      birth_city: rider.birthCity,

      // El valor es un src de next/image: otro host que no esté en remotePatterns tumba la página en desarrollo.
      image_url: entry.images[0]?.mainUrl?.startsWith(IMAGE_URL_PREFIX)
        ? entry.images[0].mainUrl
        : null,

      biography: htmlToPlainText(biographyByRider.get(rider.id)),

      season_stats: hasSeasonData
        ? {
            position,
            points,
            wins: currentStats?.wins ?? 0,
            podiums: currentStats?.podiums ?? 0,
            poles: currentStats?.poles ?? 0,
            sprint_wins: isMotoGP ? (sprints?.currentSeason ?? 0) : null,
          }
        : null,

      career: {
        starts: sum("starts"),
        wins: sum("wins"),
        podiums: sum("podiums"),
        poles: sum("poles"),
        titles,
      },

      motogp: isMotoGP
        ? {
            wins: sum("wins", (row) => row.category.legacyId === MOTOGP_LEGACY_ID),
            poles: sum("poles", (row) => row.category.legacyId === MOTOGP_LEGACY_ID),
            premier_wins: sum("wins", isPremierClass),
            premier_poles: sum("poles", isPremierClass),
            sprint_wins: sprints?.total ?? 0,
          }
        : null,

      trajectory,
    };
  });

  // Por posición en el campeonato; sin posición, por dorsal; al final, por nombre.
  riders.sort(
    (a, b) =>
      (a.season_stats?.position ?? Infinity) -
        (b.season_stats?.position ?? Infinity) ||
      (a.number ?? Infinity) - (b.number ?? Infinity) ||
      a.full_name.localeCompare(b.full_name, "es")
  );

  return {
    season: season.year,
    category: carouselCategory,
    riders,
  };
}

function isPremierClass(row: { category: { legacyId: number | null } }) {
  return (
    row.category.legacyId === MOTOGP_LEGACY_ID ||
    row.category.legacyId === CATEGORY_500CC_LEGACY_ID
  );
}

/*
 * Sprints ganados (SPR con position 1) por piloto: total histórico y de la
 * temporada actual. Solo existen en MotoGP.
 */
async function loadSprintWins(
  riderIds: string[],
  currentSeasonId: string
): Promise<Map<string, SprintWins>> {
  const wins = await prisma.sessionResult.findMany({
    where: {
      riderId: { in: riderIds },
      position: 1,
      session: { type: "SPR" },
    },

    select: {
      riderId: true,
      constructor: false,
      session: { select: { event: { select: { seasonId: true } } } },
    },
  });

  const result = new Map<string, SprintWins>();

  for (const win of wins) {
    const current = result.get(win.riderId) ?? { total: 0, currentSeason: 0 };

    current.total += 1;

    if (win.session.event.seasonId === currentSeasonId) {
      current.currentSeason += 1;
    }

    result.set(win.riderId, current);
  }

  return result;
}
