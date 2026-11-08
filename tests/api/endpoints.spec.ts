// Comprobaciones de endpoints (capa A de TESTS.md, API-01..API-09).
// Solo lectura y por reglas: no dependen de los datos del día. Corren en local
// (build de producción sobre motogp_test) y contra producción con BASE_URL.
import { expect, test, type APIRequestContext } from "@playwright/test";

type Json = Record<string, unknown>;

async function getData(request: APIRequestContext, path: string, allowed = [200]) {
  const response = await request.get(path);
  expect(allowed, `${path} devolvió ${response.status()}`).toContain(response.status());
  const body = (await response.json()) as Json;
  if (response.ok()) {
    expect(body, `${path} sin { data }`).toHaveProperty("data");
    return { status: response.status(), data: body.data as never };
  }
  expect(typeof body.error, `${path} error sin texto`).toBe("string");
  return { status: response.status(), data: null as never };
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);
const isIso = (iso: unknown) => typeof iso === "string" && !Number.isNaN(new Date(iso).getTime());
const isDay = (day: unknown) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);

// Estados vistos en la API de resultados; uno nuevo debe revisarse a mano antes de aceptarlo.
const EVENT_STATUSES = ["FINISHED", "CURRENT", "NOT-STARTED", "CANCELLED"];
const SESSION_STATUSES = ["FINISHED", "CURRENT", "NOT-STARTED", "CANCELLED"];
const DAY = 24 * 3600_000;

interface CalendarSession {
  id: string;
  shortname: string;
  status: string;
  date_start: string | null;
  date_end: string | null;
  category: string;
  category_legacy_id: number;
}
interface CalendarEvent {
  id: string;
  name: string;
  status: string;
  round: number | null;
  date_start: string;
  date_end: string;
  is_next_gp: boolean;
  sessions: CalendarSession[];
}

test.describe("API-01 /api/calendar", () => {
  test("eventos y sesiones coherentes", async ({ request }) => {
    const { data } = await getData(request, "/api/calendar");
    const events = data as CalendarEvent[];
    expect(Array.isArray(events)).toBe(true);

    expect(events.filter((e) => e.is_next_gp).length, "más de un is_next_gp").toBeLessThanOrEqual(1);
    expect(events.filter((e) => e.status === "CURRENT").length, "más de un evento CURRENT").toBeLessThanOrEqual(1);

    let lastRound = 0;
    for (const event of events) {
      const where = `${event.name} (${event.id})`;
      expect(EVENT_STATUSES, `${where}: estado ${event.status}`).toContain(event.status);
      expect(isDay(event.date_start) && isDay(event.date_end), `${where}: fechas del evento`).toBe(true);
      expect(event.date_end >= event.date_start, `${where}: fin antes que inicio`).toBe(true);
      if (event.round !== null) {
        expect(event.round, `${where}: rondas no crecientes`).toBeGreaterThan(lastRound);
        lastRound = event.round;
      }

      // Ventana del fin de semana con margen de zona horaria (±14 h).
      const from = new Date(`${event.date_start}T00:00:00Z`).getTime() - 14 * 3600_000;
      const to = new Date(`${event.date_end}T00:00:00Z`).getTime() + DAY + 14 * 3600_000;
      let previous = -Infinity;
      let seenUndated = false;

      for (const session of event.sessions) {
        const label = `${where} ${session.category} ${session.shortname}`;
        expect(SESSION_STATUSES, `${label}: estado ${session.status}`).toContain(session.status);
        expect([1, 2, 3], `${label}: categoría`).toContain(session.category_legacy_id);

        if (session.date_start === null) {
          seenUndated = true;
          expect(session.date_end, `${label}: fin sin inicio`).toBeNull();
          continue;
        }
        expect(seenUndated, `${label}: sesión con fecha tras una sin fecha`).toBe(false);
        expect(isIso(session.date_start), `${label}: inicio inválido`).toBe(true);
        const start = time(session.date_start);
        expect(start >= from && start <= to, `${label}: fuera del fin de semana (${session.date_start})`).toBe(true);
        expect(start, `${label}: sesiones desordenadas`).toBeGreaterThanOrEqual(previous);
        previous = start;

        if (session.date_end !== null) {
          expect(isIso(session.date_end), `${label}: fin inválido`).toBe(true);
          expect(time(session.date_end), `${label}: fin no posterior al inicio`).toBeGreaterThan(start);
        }
      }
    }
  });
});

test.describe("API-02 /api/next-gp", () => {
  test("coincide con el is_next_gp del calendario", async ({ request }) => {
    const next = await getData(request, "/api/next-gp", [200, 404]);
    const { data: calendar } = await getData(request, "/api/calendar");
    const flagged = (calendar as CalendarEvent[]).find((e) => e.is_next_gp);

    if (next.status === 404) {
      expect(flagged, "404 en next-gp pero el calendario marca un próximo GP").toBeUndefined();
      return;
    }
    const gp = next.data as Json & { id: string; round: number | null; nextMotoGPRace: string; date_end: string };
    expect(isIso(gp.nextMotoGPRace), "nextMotoGPRace inválido").toBe(true);
    // Solo con datos vivos: motogp_test es un volcado congelado y su "próximo GP" ya pasó.
    if (process.env.BASE_URL) {
      expect(time(gp.nextMotoGPRace), "la carrera ya pasó hace más de un día").toBeGreaterThan(Date.now() - DAY);
    }
    expect(flagged?.id, "el calendario no marca este GP como próximo").toBe(gp.id);
    expect(flagged?.round, "ronda distinta entre next-gp y calendario").toBe(gp.round);
  });
});

test.describe("API-03 /api/next-gp/favorites", () => {
  test("índices y probabilidades válidos, mismo GP que next-gp", async ({ request }) => {
    const fav = await getData(request, "/api/next-gp/favorites", [200, 404]);
    if (fav.status === 404) return;
    const data = fav.data as {
      event: { id: string };
      favorites: { rank: number; score: number; win_probability: number; circuit_history: unknown[] }[];
    };

    const ranks = data.favorites.map((f) => f.rank);
    expect(ranks, "rangos con huecos").toEqual(ranks.map((_, i) => i + 1));
    for (const f of data.favorites) {
      expect(Number.isInteger(f.score) && f.score >= 0 && f.score <= 100, `score ${f.score}`).toBe(true);
      expect(f.win_probability).toBeGreaterThanOrEqual(0);
      expect(f.circuit_history.length).toBeLessThanOrEqual(8);
    }
    if (data.favorites.length > 0) {
      const sum = data.favorites.reduce((acc, f) => acc + f.win_probability, 0);
      expect(Math.abs(sum - 100), `probabilidades suman ${sum}`).toBeLessThanOrEqual(1);
    }

    const next = await getData(request, "/api/next-gp", [200, 404]);
    if (next.status === 200) expect(data.event.id).toBe((next.data as { id: string }).id);
  });
});

test.describe("API-04 /api/riders/standings", () => {
  test("ordenada por puntos y sin pilotos repetidos", async ({ request }) => {
    const { data } = await getData(request, "/api/riders/standings");
    const riders = data as { id: string; full_name: string; statistics: { points: number } }[];
    expect(riders.length).toBeGreaterThan(0);

    const ids = riders.map((r) => r.id);
    expect(new Set(ids).size, "ids repetidos").toBe(ids.length);
    const names = riders.map((r) => r.full_name);
    expect(new Set(names).size, "pilotos repetidos por nombre").toBe(names.length);
    riders.forEach((r, i) => {
      expect(r.statistics.points, `${r.full_name}: puntos negativos`).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(r.statistics.points).toBeLessThanOrEqual(riders[i - 1].statistics.points);
    });
  });
});

test.describe("API-05 /api/constructors/standings", () => {
  test("ordenada con posiciones 1..n únicas", async ({ request }) => {
    const { data } = await getData(request, "/api/constructors/standings");
    const rows = data as { name: string; position: number; points: number }[];
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i + 1));
    rows.forEach((r, i) => {
      if (i > 0) expect(r.points).toBeLessThanOrEqual(rows[i - 1].points);
    });
  });
});

test.describe("API-06 /api/results", () => {
  interface Results {
    years: number[];
    events: { id: string }[];
    categories: { legacy_id: number }[];
    sessions: { shortname: string }[];
    selected: { year: number; event: string; category: number; session: string };
    rows: { position: number | null }[];
  }

  function checkSelection(data: Results, where: string) {
    expect(data.years, `${where}: año seleccionado`).toContain(data.selected.year);
    expect(data.events.map((e) => e.id), `${where}: evento`).toContain(data.selected.event);
    expect(data.categories.map((c) => c.legacy_id), `${where}: categoría`).toContain(data.selected.category);
    expect(data.sessions.map((s) => s.shortname), `${where}: sesión`).toContain(data.selected.session);
    // Clasificados primero y en orden; los sin posición, al final.
    const positions = data.rows.map((r) => r.position);
    const firstNull = positions.indexOf(null);
    const classified = (firstNull === -1 ? positions : positions.slice(0, firstNull)) as number[];
    expect(classified, `${where}: orden`).toEqual([...classified].sort((a, b) => a - b));
    if (firstNull !== -1) expect(positions.slice(firstNull).every((p) => p === null)).toBe(true);
  }

  for (const query of ["", "section=tests", "year=abc", "category=zzz", "event=no-existe", "session=XXX"]) {
    test(`selección coherente ?${query}`, async ({ request }) => {
      const res = await getData(request, `/api/results?${query}`, [200, 404]);
      if (res.status === 200) checkSelection(res.data as Results, query || "(sin parámetros)");
    });
  }

  test("años en orden descendente y un año anterior también funciona", async ({ request }) => {
    const { data } = await getData(request, "/api/results");
    const years = (data as Results).years;
    expect(years).toEqual([...years].sort((a, b) => b - a));
    const older = years[years.length - 1];
    const res = await getData(request, `/api/results?year=${older}`, [200, 404]);
    if (res.status === 200) expect((res.data as Results).selected.year).toBe(older);
  });
});

interface ProgressRider {
  id: string;
  full_name: string;
  final_position: number | null;
  standing_points: number | null;
  total_points: number | null;
  progress: { event_id: string; points: number | null; sprint_points: number | null; race_points: number | null; cumulative: number | null }[];
}
interface Progress {
  season: number;
  category: number;
  events: { id: string; sequence: number | null; short_name: string | null }[];
  riders: ProgressRider[];
}

test.describe("GRA-A /api/riders/points-progress", () => {
  const url = "/api/riders/points-progress";

  test("GRA-A01 forma y reglas de nulos y acumulado", async ({ request }) => {
    const { data } = await getData(request, url, [200, 404]);
    if (!data) return;
    const { events, riders } = data as Progress;
    expect(events.length).toBeGreaterThan(0);

    const sequences = events.map((e) => e.sequence ?? Infinity);
    expect(sequences, "eventos desordenados").toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(events.map((e) => e.id)).size, "eventos repetidos").toBe(events.length);

    expect(new Set(riders.map((r) => r.id)).size, "pilotos repetidos").toBe(riders.length);
    const positions = riders.map((r) => r.final_position ?? Infinity);
    expect(positions, "pilotos sin ordenar por posición final").toEqual([...positions].sort((a, b) => a - b));

    for (const rider of riders) {
      expect(rider.progress.map((p) => p.event_id), `${rider.full_name}: un paso por evento`).toEqual(events.map((e) => e.id));
      let previous: number | null = null;
      for (const step of rider.progress) {
        const where = `${rider.full_name} ${step.event_id}`;
        if (step.points === null) {
          // Sin fila: nunca un 0 inventado y acumulado plano.
          expect(step.sprint_points, `${where}: sprint sin GP`).toBeNull();
          expect(step.race_points, `${where}: carrera sin GP`).toBeNull();
          expect(step.cumulative, `${where}: acumulado no plano`).toBe(previous);
        } else {
          expect(step.points, `${where}: puntos negativos`).toBeGreaterThanOrEqual(0);
          expect(step.cumulative, `${where}: acumulado nulo con puntos`).not.toBeNull();
          expect(Math.abs((step.cumulative as number) - ((previous ?? 0) + step.points)), `${where}: acumulado`).toBeLessThan(0.01);
        }
        previous = step.cumulative;
      }
      expect(rider.total_points, `${rider.full_name}: total`).toBe(previous);
    }
  });

  test("GRA-A02 parámetros inválidos dan 400 con { error }", async ({ request }) => {
    for (const query of ["year=abc", "year=1800", "year=", "category=9", "category=abc", "category="]) {
      const response = await request.get(`${url}?${query}`);
      expect(response.status(), query).toBe(400);
      expect(typeof ((await response.json()) as Json).error, `${query}: error sin texto`).toBe("string");
    }
  });

  test("GRA-A03 el último acumulado coincide con la clasificación (temporada cerrada)", async ({ request }) => {
    const { data } = await getData(request, `${url}?year=2024&category=3`, [200, 404]);
    if (!data) return;
    for (const rider of (data as Progress).riders) {
      if (rider.standing_points === null) continue;
      expect(rider.total_points ?? 0, `${rider.full_name}`).toBeCloseTo(rider.standing_points, 2);
    }
  });

  test("GRA-A04 otros métodos dan 405", async ({ request }) => {
    expect((await request.post(url, { data: {} })).status()).toBe(405);
  });
});

test.describe("API-07/08/09 rutas ocultas y páginas", () => {
  test("/api/riders/carousel da 404 en producción", async ({ request }) => {
    expect((await request.get("/api/riders/carousel")).status()).toBe(404);
  });

  test("/api/dev/image-issue da 404 en producción", async ({ request }) => {
    const response = await request.post("/api/dev/image-issue", { data: {} });
    expect(response.status()).toBe(404);
  });

  for (const path of ["/", "/calendario", "/resultados", "/aviso-legal"]) {
    test(`página ${path} responde 200`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(200);
    });
  }

  for (const path of ["/pilotos", "/no-existe-esta-pagina"]) {
    test(`página ${path} da 404`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }

  test("métodos no previstos no dan 500", async ({ request }) => {
    const response = await request.post("/api/calendar", { data: {} });
    expect(response.status()).toBe(405);
  });
});

// Cuentas APAGADAS por defecto (REGISTRO_ABIERTO): la API de cuentas no existe y el estado lo dice.
test.describe("CUE-A cuentas apagadas", () => {
  test("/api/cuenta/estado responde 200 con abierto=false y sin usuario", async ({ request }) => {
    const response = await request.get("/api/cuenta/estado");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ data: { abierto: false, usuario: null } });
  });

  test("las rutas de cuentas dan 404 y no tocan la base", async ({ request }) => {
    expect((await request.get("/api/auth/get-session")).status()).toBe(404);
    expect((await request.post("/api/auth/sign-in/email", { data: { email: "a@b.es", password: "x" } })).status()).toBe(404);
    expect((await request.put("/api/cuenta/color", { data: { color: "#112233" } })).status()).toBe(404);
    expect((await request.post("/api/cuenta/eliminar", { data: { password: "x" } })).status()).toBe(404);
  });
});
