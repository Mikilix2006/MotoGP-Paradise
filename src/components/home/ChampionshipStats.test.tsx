// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChampionshipStats from "../ChampionshipStats";
import { nextGpConPista, nextGpSinPista } from "./__fixtures__/nextGp";
import { mockFetch, ok } from "./__fixtures__/mockFetch";
import { pilotosConEmpates } from "./__fixtures__/standings";

const MENSAJE = "No se pudieron cargar las estadísticas del campeonato";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChampionshipStats", () => {
  it("INI-05: líder, equipo y puntos; con empate gana el primero de la API", async () => {
    mockFetch({
      "/api/riders/standings": ok([pilotosConEmpates[2], pilotosConEmpates[0], pilotosConEmpates[1]]),
      "/api/next-gp": ok(nextGpConPista),
    });
    render(<ChampionshipStats />);

    // El de más puntos manda aunque no venga primero; entre Uno y Dos (200) gana Uno (orden de la API).
    expect(await screen.findByText("Piloto Uno")).toBeInTheDocument();
    expect(screen.queryByText("Piloto Dos")).not.toBeInTheDocument();
    expect(screen.getByText("#1 · Equipo Piloto Uno")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("INI-05: datos del circuito, imagen y sprint (tu hora)", async () => {
    mockFetch({ "/api/riders/standings": ok(pilotosConEmpates), "/api/next-gp": ok(nextGpConPista) });
    render(<ChampionshipStats />);

    await screen.findByText("Piloto Uno");
    expect(screen.getByText("5.38")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByAltText("Información del circuito")).toHaveAttribute("src", "https://photos.motogp.com/circuito.svg");
    expect(screen.getByText("sábado, 7 de marzo")).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByText("Tu hora")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("INI-05: sin datos del circuito todo sale como guion y no hay imagen", async () => {
    mockFetch({ "/api/riders/standings": ok(pilotosConEmpates), "/api/next-gp": ok(nextGpSinPista) });
    render(<ChampionshipStats />);

    await screen.findByText("Piloto Uno");
    // km, curvas, vueltas, día, hora y vueltas de sprint
    expect(screen.getAllByText("—")).toHaveLength(6);
    expect(screen.queryByAltText("Información del circuito")).not.toBeInTheDocument();
  });

  it("muestra el esqueleto mientras carga", () => {
    mockFetch({ "/api/riders/standings": "pendiente", "/api/next-gp": "pendiente" });
    render(<ChampionshipStats />);

    expect(screen.getByRole("status", { name: "Cargando estadísticas del campeonato" })).toBeInTheDocument();
  });

  it.each([
    ["falla la clasificación", { "/api/riders/standings": { status: 500 }, "/api/next-gp": ok(nextGpConPista) }],
    ["falla el próximo GP", { "/api/riders/standings": ok(pilotosConEmpates), "/api/next-gp": { status: 404 } }],
    ["no hay pilotos", { "/api/riders/standings": ok([]), "/api/next-gp": ok(nextGpConPista) }],
    ["data ausente", { "/api/riders/standings": { body: {} }, "/api/next-gp": ok(nextGpConPista) }],
  ])("INI-07: error si %s", async (_caso, rutas) => {
    mockFetch(rutas);
    render(<ChampionshipStats />);

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE);
  });
});
