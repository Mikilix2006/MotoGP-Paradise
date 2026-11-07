// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PointsProgress, PointsProgressRider } from "@/types/pointsProgress";

let search = new URLSearchParams("temporada=2026");
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/graficas",
  useSearchParams: () => search,
}));

import GraficasPage from "./GraficasPage";

const step = (event_id: string, points: number | null, cumulative: number | null, sprint: number | null = null) => ({
  event_id,
  points,
  sprint_points: sprint,
  race_points: points === null ? null : points - (sprint ?? 0),
  cumulative,
});

const rider = (n: number, progress: PointsProgressRider["progress"]): PointsProgressRider => ({
  id: `id${n}`,
  full_name: `Piloto ${n}`,
  number: n,
  team: { id: `t${n}`, name: `Equipo ${n}`, color: null },
  constructor_name: "Ducati",
  final_position: n,
  standing_points: null,
  total_points: null,
  progress,
});

const events = ["THA", "BRA", "USA"].map((short, i) => ({
  id: `e${i}`,
  short_name: short,
  name: `GRAND PRIX ${short}`,
  circuit_name: `Circuito de ${short}`,
  country_iso: null,
  country_name: "País",
  sequence: i + 1,
}));

const payload: PointsProgress = {
  season: 2026,
  category: 3,
  events,
  riders: [1, 2, 3, 4, 5, 6, 7].map((n) =>
    // El piloto 2 no corre en el segundo GP (hueco en "por carrera").
    n === 2
      ? rider(n, [step("e0", 20, 20), step("e1", null, 20), step("e2", 25, 45)])
      : rider(n, [step("e0", 25, 25, 12), step("e1", 16, 41), step("e2", 10, 51)])
  ),
};

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const stubFetch = (status = 200, body: unknown = { data: payload }) => {
  const fn = vi.fn(() => json(status, body));
  vi.stubGlobal("fetch", fn);
  return fn;
};

afterEach(() => {
  vi.unstubAllGlobals();
  search = new URLSearchParams("temporada=2026");
  push.mockClear();
  replace.mockClear();
});


describe("GraficasPage (GRA-C)", () => {
  it("GRA-C01 carga: pide la temporada y categoría, marca el top 5 y pinta leyenda-selector única", async () => {
    const fetchMock = stubFetch();
    render(<GraficasPage />);
    expect(screen.getByRole("status", { name: "Cargando gráfica" })).toBeInTheDocument();

    const boxes = await screen.findAllByRole("checkbox");
    expect(fetchMock).toHaveBeenCalledWith("/api/riders/points-progress?year=2026&category=3", expect.anything());
    expect(boxes).toHaveLength(7);
    expect(boxes.filter((b) => (b as HTMLInputElement).checked)).toHaveLength(5);
    expect(screen.queryByRole("list", { name: "Leyenda" })).not.toBeInTheDocument(); // la leyenda es la lista de casillas
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "MotoGP" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Acumulado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("GRA-C02 la URL manda sobre el top 5 (dorsales) y las fichas desconocidas se ignoran", async () => {
    search = new URLSearchParams("temporada=2025&categoria=2&modo=carrera&pilotos=6,7,999");
    const fetchMock = stubFetch();
    render(<GraficasPage />);
    const boxes = await screen.findAllByRole("checkbox");
    expect(fetchMock).toHaveBeenCalledWith("/api/riders/points-progress?year=2025&category=2", expect.anything());
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([false, false, false, false, false, true, true]);
    expect(screen.getByRole("button", { name: "Por carrera" })).toHaveAttribute("aria-pressed", "true");
  });

  it("GRA-C03 Top 5, Todos, Ninguno y casillas escriben la selección en la URL", async () => {
    stubFetch();
    const user = userEvent.setup();
    render(<GraficasPage />);
    await screen.findAllByRole("checkbox");

    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining("pilotos=1%2C2%2C3%2C4%2C5%2C6%2C7"), expect.anything());
    await user.click(screen.getByRole("button", { name: "Ninguno" }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringMatching(/pilotos=(&|$)/), expect.anything());
    await user.click(screen.getByRole("button", { name: "Top 5" }));
    expect(replace).toHaveBeenLastCalledWith(expect.not.stringContaining("pilotos"), expect.anything());
    await user.click(screen.getByRole("checkbox", { name: /Piloto 5/ }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining("pilotos=1%2C2%2C3%2C4"), expect.anything());
  });

  it("GRA-C04 cambiar de categoría o temporada reinicia al top 5 (sin pilotos en la URL)", async () => {
    search = new URLSearchParams("temporada=2026&pilotos=6,7");
    stubFetch();
    const user = userEvent.setup();
    render(<GraficasPage />);
    await screen.findAllByRole("checkbox");

    await user.click(screen.getByRole("button", { name: "Moto2" }));
    expect(push).toHaveBeenLastCalledWith("/graficas?temporada=2026&categoria=2&modo=acumulado", expect.anything());
    await user.selectOptions(screen.getByLabelText("Temporada"), "2024");
    expect(push).toHaveBeenLastCalledWith("/graficas?temporada=2024&categoria=3&modo=acumulado", expect.anything());
  });

  it("GRA-C05 por carrera: el GP sin participación es un hueco (línea cortada y sin punto), nunca 0", async () => {
    search = new URLSearchParams("temporada=2026&pilotos=2&modo=carrera");
    stubFetch();
    const { container } = render(<GraficasPage />);
    await screen.findByRole("group", { name: /Gráfica de/ });
    const group = container.querySelector('[data-rider="id2"]')!;
    expect(group.querySelector("path")!.getAttribute("d")!.match(/M/g)).toHaveLength(2);
    expect(group.querySelectorAll("circle")).toHaveLength(2);
  });

  it("GRA-C06 acumulado: la línea es continua y la plana del piloto 2 tiene punto en cada GP", async () => {
    search = new URLSearchParams("temporada=2026&pilotos=2");
    stubFetch();
    const { container } = render(<GraficasPage />);
    await screen.findByRole("group", { name: /Gráfica de/ });
    const group = container.querySelector('[data-rider="id2"]')!;
    expect(group.querySelector("path")!.getAttribute("d")!.match(/M/g)).toHaveLength(1);
    expect(group.querySelectorAll("circle")).toHaveLength(3);
  });

  it("GRA-C07 teclado en la gráfica: la flecha muestra circuito, desglose sprint/carrera y acumulado", async () => {
    search = new URLSearchParams("temporada=2026&pilotos=1,2");
    stubFetch();
    const user = userEvent.setup();
    render(<GraficasPage />);
    await screen.findAllByRole("checkbox");

    const chart = await screen.findByRole("group", { name: /Gráfica de puntos acumulados/ });
    chart.focus();
    await user.keyboard("{ArrowRight}");
    const tip = screen.getByRole("status");
    expect(tip).toHaveTextContent("Circuito de THA");
    expect(tip).toHaveTextContent("1 Piloto 1: 25 pts (sprint 12, carrera 13) · acum. 25");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("2 Piloto 2: no participó · acum. 20");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("GRA-C08 sin pilotos seleccionados: mensaje en lugar de gráfica", async () => {
    search = new URLSearchParams("temporada=2026&pilotos=");
    stubFetch();
    render(<GraficasPage />);
    expect(await screen.findByText("Selecciona al menos un piloto para ver la gráfica.")).toBeInTheDocument();
  });

  it("GRA-C09 error: muestra el mensaje y Reintentar vuelve a pedir y se recupera", async () => {
    const fn = vi.fn().mockImplementationOnce(() => json(500, { error: "TypeError: x is undefined" }));
    fn.mockImplementation(() => json(200, { data: payload }));
    vi.stubGlobal("fetch", fn);
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GraficasPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la gráfica de puntos.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("TypeError");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findAllByRole("checkbox")).toHaveLength(7);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("GRA-C11 respuesta 200 sin data: mensaje fijo en español, no el error crudo", async () => {
    stubFetch(200, { message: "otra cosa" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GraficasPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la gráfica de puntos.");
  });

  it("GRA-C10 vacío: 404 y respuesta sin GP muestran el estado vacío", async () => {
    stubFetch(404, { error: "No hay datos para esa temporada y categoría" });
    const first = render(<GraficasPage />);
    expect(await screen.findByText(/No hay Grandes Premios disputados/)).toBeInTheDocument();
    first.unmount();

    stubFetch(200, { data: { ...payload, events: [], riders: [] } });
    render(<GraficasPage />);
    expect(await screen.findByText(/No hay Grandes Premios disputados/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
