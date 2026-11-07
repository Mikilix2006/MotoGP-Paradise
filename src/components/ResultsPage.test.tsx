// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultsPayload } from "@/types/results";

let search = new URLSearchParams("year=2026");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
