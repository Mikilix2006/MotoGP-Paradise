// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RiderStandings from "../RiderStandings";
import { mockFetch, ok } from "./__fixtures__/mockFetch";
import { constructoresConEmpate, pilotosConEmpates, pilotosPosicionNula } from "./__fixtures__/standings";

const PILOTOS = "/api/riders/standings";
const CONSTRUCTORES = "/api/constructors/standings";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Fila (rejilla) de un piloto o equipo a partir de su nombre.
const fila = (nombre: string) => screen.getByText(nombre).closest("div.grid") as HTMLElement;

describe("RiderStandings: pilotos", () => {
  it("INI-08: lista en el orden de la API, posición a dos cifras y contador", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosConEmpates) });
    render(<RiderStandings />);

    await screen.findByText("Piloto Uno");
    const nombres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(nombres).toEqual(["Piloto Uno", "Piloto Dos", "Piloto Tres", "Piloto Cuatro", "Piloto Cinco"]);
    expect(screen.getByText("5 pilotos")).toBeInTheDocument();
    expect(within(fila("Piloto Cinco")).getByText("05")).toBeInTheDocument();
    // Empates: dos pilotos comparten la posición 01 y dos la 03.
    expect(screen.getAllByText("01")).toHaveLength(2);
    expect(screen.getAllByText("03")).toHaveLength(2);
  });

  it("INI-08: podio con estilo propio en los 3 primeros y colores oro, plata y bronce", async () => {
    mockFetch({
      [PILOTOS]: ok([
        { ...pilotosConEmpates[0] },
        { ...pilotosConEmpates[1], statistics: { ...pilotosConEmpates[1].statistics, position: 2 } },
        { ...pilotosConEmpates[2] },
        { ...pilotosConEmpates[3], statistics: { ...pilotosConEmpates[3].statistics, position: 4 } },
      ]),
    });
    render(<RiderStandings />);
    await screen.findByText("Piloto Uno");

    const posicion = (nombre: string, texto: string) => within(fila(nombre)).getByText(texto);
    expect(posicion("Piloto Uno", "01").className).toContain("accent-grad");
    expect(posicion("Piloto Dos", "02").className).toContain("accent-grad");
    expect(posicion("Piloto Tres", "03").className).toContain("accent-grad");
    expect(posicion("Piloto Cuatro", "04").className).not.toContain("accent-grad");

    expect(within(fila("Piloto Uno")).getByText("200").className).toContain("--gold");
    expect(within(fila("Piloto Dos")).getByText("200").className).toContain("--silver");
    expect(within(fila("Piloto Tres")).getByText("150").className).toContain("--bronze");
    expect(within(fila("Piloto Cuatro")).getByText("150").className).toContain("text-white");
  });

  it("INI-08: bandera solo cuando el piloto tiene ISO", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosConEmpates) });
    render(<RiderStandings />);
    await screen.findByText("Piloto Uno");

    expect(screen.getAllByAltText("Bandera de España")).toHaveLength(4);
    expect(within(fila("Piloto Cinco")).queryByRole("img")).not.toBeInTheDocument();
  });

  it("muestra el esqueleto y luego el error de la clasificación", async () => {
    mockFetch({ [PILOTOS]: { status: 500 } });
    render(<RiderStandings />);

    expect(screen.getByRole("status", { name: "Cargando clasificación" })).toBeInTheDocument();
    expect(await screen.findByText("No se pudo cargar la clasificación de pilotos")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ pilotos$/)).not.toBeInTheDocument();
  });

  // INI-09: confirmada, `position <= 3` es cierto para 0 y String(0).padStart(2, "0") da "00".
  it.fails("SOSPECHA: un piloto sin posición no se muestra como '00' (INI-09)", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosPosicionNula) });
    render(<RiderStandings />);
    await screen.findByText("Piloto Sin Posición");

    expect(within(fila("Piloto Sin Posición")).queryByText("00")).not.toBeInTheDocument();
  });

  it.fails("SOSPECHA: un piloto sin posición no lleva el estilo de podio (INI-09)", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosPosicionNula) });
    render(<RiderStandings />);
    await screen.findByText("Piloto Sin Posición");

    const fichaPosicion = fila("Piloto Sin Posición").firstElementChild!.firstElementChild!;
    expect(fichaPosicion.className).not.toContain("accent-grad");
  });
});

describe("RiderStandings: constructores", () => {
  const abrirConstructores = async () => {
    const user = userEvent.setup();
    render(<RiderStandings />);
    await screen.findByText("Piloto Uno");
    await user.click(screen.getByRole("button", { name: "Constructores" }));
    return user;
  };

  it("INI-10: se carga solo al abrir la pestaña y una sola vez", async () => {
    const fetchMock = mockFetch({ [PILOTOS]: ok(pilotosConEmpates), [CONSTRUCTORES]: ok(constructoresConEmpate) });
    render(<RiderStandings />);
    const user = userEvent.setup();
    await screen.findByText("Piloto Uno");
    expect(fetchMock).not.toHaveBeenCalledWith(CONSTRUCTORES);

    await user.click(screen.getByRole("button", { name: "Constructores" }));
    expect(await screen.findByText("Ducati Lenovo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pilotos" }));
    await user.click(screen.getByRole("button", { name: "Constructores" }));

    await screen.findByText("Ducati Lenovo");
    expect(fetchMock.mock.calls.filter(([url]) => url === CONSTRUCTORES)).toHaveLength(1);
  });

  it("INI-10: muestra el contador, respeta el orden de la API en los empates y pone banderas por marca", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosConEmpates), [CONSTRUCTORES]: ok(constructoresConEmpate) });
    await abrirConstructores();

    await screen.findByText("Ducati Lenovo");
    expect(screen.getByText("4 equipos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clasificación de constructores" })).toBeInTheDocument();
    // Ducati y Aprilia empatan a 300; la API ya los entrega desempatados por victorias.
    const nombres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(nombres).toEqual(["Ducati Lenovo", "Aprilia Racing", "KTM Factory", "Equipo Raro"]);
    expect(screen.getAllByAltText("Bandera de Italia")).toHaveLength(2);
    expect(screen.getAllByAltText("Bandera de Austria")).toHaveLength(1);
    expect(within(fila("Equipo Raro")).queryByRole("img")).not.toBeInTheDocument();
  });

  it("INI-10: sin puntos muestra el mensaje de vacío y sin contador", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosConEmpates), [CONSTRUCTORES]: ok([]) });
    await abrirConstructores();

    expect(await screen.findByText("Todavía no hay puntos de constructores esta temporada.")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ equipos$/)).not.toBeInTheDocument();
  });

  it("INI-10: mientras carga muestra el esqueleto", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosConEmpates), [CONSTRUCTORES]: "pendiente" });
    await abrirConstructores();

    expect(screen.getByRole("status", { name: "Cargando clasificación" })).toBeInTheDocument();
  });

  it("INI-10: un error de la API muestra el mensaje", async () => {
    mockFetch({ [PILOTOS]: ok(pilotosConEmpates), [CONSTRUCTORES]: { status: 500 } });
    await abrirConstructores();

    expect(await screen.findByText("No se pudo cargar la clasificación de constructores")).toBeInTheDocument();
  });

  // INI-10: confirmada, el efecto sale si hay `constructorsError` y nada lo limpia (RiderStandings.tsx, useEffect de constructores).
  it.fails("SOSPECHA: tras un error, volver a abrir la pestaña reintenta (INI-10)", async () => {
    const fetchMock = mockFetch({ [PILOTOS]: ok(pilotosConEmpates), [CONSTRUCTORES]: { status: 500 } });
    const user = await abrirConstructores();
    await screen.findByText("No se pudo cargar la clasificación de constructores");

    await user.click(screen.getByRole("button", { name: "Pilotos" }));
    await user.click(screen.getByRole("button", { name: "Constructores" }));

    expect(fetchMock.mock.calls.filter(([url]) => url === CONSTRUCTORES).length).toBeGreaterThan(1);
  });
});
