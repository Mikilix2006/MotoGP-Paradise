// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultsPayload } from "@/types/results";

let search = new URLSearchParams("year=2026");
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/resultados",
  useSearchParams: () => search,
}));

import ResultsPage from "./ResultsPage";

const payload: ResultsPayload = {
  section: "season",
  years: [2026],
  events: [{ id: "qat", label: "Qatar" }],
  categories: [{ legacy_id: 3, label: "MotoGP" }],
  sessions: [{ shortname: "RAC", label: "Carrera" }],
  selected: { year: 2026, event: "qat", category: 3, session: "RAC" },
  is_race: true,
  rows: [
    {
      position: 1,
      rider_name: "Piloto Uno",
      number: 1,
      team_name: "Equipo",
      status: "INSTND",
      time: "41:00.000",
      gap: null,
      fastest_lap: null,
      points: 25,
      laps_completed: 22,
    },
  ],
};

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  search = new URLSearchParams("year=2026");
  push.mockClear();
});

// Fetch que se resuelve a mano y rechaza con AbortError al abortarse, como el real.
function deferredFetch() {
  const pending: { url: string; resolve: (body: unknown) => void }[] = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      pending.push({ url, resolve: (body) => resolve(new Response(JSON.stringify({ data: body }), { status: 200 })) });
      init?.signal?.addEventListener("abort", () => reject(new DOMException("abortado", "AbortError")));
    });
  });
  return { fn, pending };
}

const multi: ResultsPayload = {
  ...payload,
  years: [2026, 2025],
  events: [{ id: "qat", label: "Qatar" }, { id: "jer", label: "Jerez" }],
  categories: [{ legacy_id: 3, label: "MotoGP" }, { legacy_id: 2, label: "Moto2" }],
  sessions: [{ shortname: "FP1", label: "Libres 1" }, { shortname: "RAC", label: "Carrera" }],
};

const testRow = (position: number, fastest_lap: string | null) => ({
  ...payload.rows[0],
  position,
  rider_name: `Piloto ${position}`,
  time: null,
  gap: position === 1 ? "0.000" : "0.5",
  fastest_lap,
  points: null,
});

const lastPush = () => {
  const [url] = push.mock.calls.at(-1)!;
  const [path, query] = (url as string).split("?");
  return { path, params: Object.fromEntries(new URLSearchParams(query)) };
};

describe("ResultsPage: pestañas (RES-01)", () => {
  it("'Temporada' está activa por defecto; 'Tests' con section=tests en la URL", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: payload })));
    const { unmount } = render(<ResultsPage />);
    expect(screen.getByRole("button", { name: "Temporada" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tests" })).toHaveAttribute("aria-pressed", "false");
    await screen.findByText("Piloto Uno");
    unmount();

    search = new URLSearchParams("section=tests");
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: { ...payload, section: "tests" } })));
    render(<ResultsPage />);
    expect(screen.getByRole("button", { name: "Tests" })).toHaveAttribute("aria-pressed", "true");
    await screen.findByText("Piloto Uno");
  });

  it("pulsar 'Tests' añade section=tests; volver a 'Temporada' lo quita", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: payload })));
    const user = userEvent.setup();
    const { unmount } = render(<ResultsPage />);
    await screen.findByText("Piloto Uno");

    await user.click(screen.getByRole("button", { name: "Tests" }));
    expect(lastPush()).toEqual({
      path: "/resultados",
      params: { year: "2026", event: "qat", category: "3", session: "RAC", section: "tests" },
    });
    unmount();

    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: { ...payload, section: "tests" } })));
    render(<ResultsPage />);
    await screen.findByText("Piloto Uno");
    await user.click(screen.getByRole("button", { name: "Temporada" }));
    expect(lastPush().params).not.toHaveProperty("section");
    expect(lastPush().params.year).toBe("2026");
  });

  it("pulsar la pestaña activa no navega", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: payload })));
    const user = userEvent.setup();
    render(<ResultsPage />);
    await screen.findByText("Piloto Uno");

    await user.click(screen.getByRole("button", { name: "Temporada" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("antes de cargar, 'Tests' navega solo con section=tests", async () => {
    const { fn } = deferredFetch();
    vi.stubGlobal("fetch", fn);
    const user = userEvent.setup();
    render(<ResultsPage />);

    await user.click(screen.getByRole("button", { name: "Tests" }));
    expect(push).toHaveBeenCalledWith("/resultados?section=tests", { scroll: false });
  });
});

describe("ResultsPage: selectores (RES-02)", () => {
  async function cargar(data: ResultsPayload = multi) {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data })));
    const user = userEvent.setup();
    render(<ResultsPage />);
    await screen.findByText("Piloto Uno");
    return user;
  }

  it("reflejan la selección resuelta que devuelve la API", async () => {
    await cargar();
    expect(screen.getByLabelText("Año")).toHaveValue("2026");
    expect(screen.getByLabelText("Circuito")).toHaveValue("qat");
    expect(screen.getByLabelText("Sesión")).toHaveValue("RAC");
    expect(screen.getByRole("button", { name: "MotoGP" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Moto2" })).toHaveAttribute("aria-pressed", "false");
  });

  it("cada cambio envía la selección completa con solo ese campo cambiado", async () => {
    const user = await cargar();
    const base = { year: "2026", event: "qat", category: "3", session: "RAC" };

    await user.selectOptions(screen.getByLabelText("Año"), "2025");
    expect(lastPush().params).toEqual({ ...base, year: "2025" });

    await user.selectOptions(screen.getByLabelText("Circuito"), "jer");
    expect(lastPush().params).toEqual({ ...base, event: "jer" });

    await user.selectOptions(screen.getByLabelText("Sesión"), "FP1");
    expect(lastPush().params).toEqual({ ...base, session: "FP1" });

    await user.click(screen.getByRole("button", { name: "Moto2" }));
    expect(lastPush().params).toEqual({ ...base, category: "2" });
    expect(lastPush().path).toBe("/resultados");
    expect(push).toHaveBeenLastCalledWith(expect.any(String), { scroll: false });
  });

  it("pulsar la categoría activa no navega", async () => {
    const user = await cargar();
    await user.click(screen.getByRole("button", { name: "MotoGP" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("en Tests, los cambios conservan section=tests", async () => {
    const user = await cargar({ ...multi, section: "tests" });
    await user.selectOptions(screen.getByLabelText("Sesión"), "FP1");
    expect(lastPush().params.section).toBe("tests");
  });

  it("el fetch usa la query de la URL", async () => {
    search = new URLSearchParams("year=2025&category=2");
    const fetchMock = vi.fn((_url: string) => json(200, { data: payload }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResultsPage />);
    await screen.findByText("Piloto Uno");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/results?year=2025&category=2");
  });
});

describe("ResultsPage: cabeceras (RES-05, RES-06)", () => {
  it("carrera: 'Tiempo' y 'Pts.'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: payload })));
    render(<ResultsPage />);
    await screen.findByText("Piloto Uno");

    expect(screen.getByRole("columnheader", { name: "Tiempo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pts." })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Mejor vuelta" })).not.toBeInTheDocument();
    expect(screen.getByText("41:00.000")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("no carrera con mejor vuelta: 'Mejor vuelta' y 'Dif.'", async () => {
    const data = { ...payload, is_race: false, rows: [testRow(1, "1:40.000"), testRow(2, "1:40.500")] };
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data })));
    render(<ResultsPage />);
    await screen.findByText("Piloto 1");

    expect(screen.getByRole("columnheader", { name: "Mejor vuelta" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Dif." })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Tiempo" })).not.toBeInTheDocument();
    expect(screen.getByText("1:40.500")).toBeInTheDocument();
    expect(screen.getByText("+0.5")).toBeInTheDocument();
  });

  it("test de pretemporada sin mejor vuelta: se oculta esa columna", async () => {
    const data = { ...payload, section: "tests" as const, is_race: false, rows: [testRow(1, null), testRow(2, null)] };
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data })));
    render(<ResultsPage />);
    await screen.findByText("Piloto 1");

    expect(screen.queryByRole("columnheader", { name: "Mejor vuelta" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Dif." })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  });

  it("una sola fila con mejor vuelta basta para mostrar la columna", async () => {
    const data = { ...payload, is_race: false, rows: [testRow(1, null), testRow(2, "1:41.000")] };
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data })));
    render(<ResultsPage />);
    await screen.findByText("Piloto 1");
    expect(screen.getByRole("columnheader", { name: "Mejor vuelta" })).toBeInTheDocument();
  });
});

describe("ResultsPage: selección rápida (RES-10)", () => {
  const con = (rider: string): ResultsPayload => ({ ...payload, rows: [{ ...payload.rows[0], rider_name: rider }] });

  it("la respuesta de una selección anterior (abortada) no se muestra", async () => {
    const { fn, pending } = deferredFetch();
    vi.stubGlobal("fetch", fn);
    const { rerender } = render(<ResultsPage />);

    search = new URLSearchParams("year=2026&event=qat");
    rerender(<ResultsPage />);
    search = new URLSearchParams("year=2026&event=jer");
    rerender(<ResultsPage />);

    expect(pending.map((p) => p.url)).toEqual([
      "/api/results?year=2026",
      "/api/results?year=2026&event=qat",
      "/api/results?year=2026&event=jer",
    ]);
    // La última llega primero; las anteriores, tarde (ya abortadas, no deben pisarla).
    pending[2].resolve(con("Piloto Jerez"));
    pending[1].resolve(con("Piloto Qatar"));
    pending[0].resolve(con("Piloto Antiguo"));

    expect(await screen.findByText("Piloto Jerez")).toBeInTheDocument();
    expect(screen.queryByText("Piloto Qatar")).not.toBeInTheDocument();
    expect(screen.queryByText("Piloto Antiguo")).not.toBeInTheDocument();
  });

  it("mientras llega la nueva selección no se ve la tabla anterior", async () => {
    const { fn, pending } = deferredFetch();
    vi.stubGlobal("fetch", fn);
    const { rerender } = render(<ResultsPage />);
    pending[0].resolve(con("Piloto Antiguo"));
    await screen.findByText("Piloto Antiguo");

    search = new URLSearchParams("year=2026&event=jer");
    rerender(<ResultsPage />);

    expect(screen.queryByText("Piloto Antiguo")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cargando clasificación")).toBeInTheDocument();
  });
});

describe("ResultsPage", () => {
  it("muestra la clasificación al cargar", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: payload })));
    render(<ResultsPage />);

    expect(screen.getByLabelText("Cargando clasificación")).toBeInTheDocument();
    expect(await screen.findByText("Piloto Uno")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando clasificación")).not.toBeInTheDocument();
  });

  it("error con el mensaje de la API y 'Reintentar' se recupera (RES-09)", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => json(500, { error: "No se pudieron obtener los resultados" }))
      .mockImplementationOnce(() => json(200, { data: payload }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResultsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron obtener los resultados");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Piloto Uno")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sin filas: 'Esta sesión no tiene resultados publicados todavía.' (RES-08)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(200, { data: { ...payload, rows: [] } })));
    render(<ResultsPage />);

    expect(await screen.findByText("Esta sesión no tiene resultados publicados todavía.")).toBeInTheDocument();
  });
});
