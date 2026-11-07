// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarView } from "./CalendarView";
import { calSession, calendarEvent } from "./calendar/__fixtures__/events";

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function mockCalendar(events: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(() => json(200, { data: events })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Un GP con horarios (próximo), uno sin sesiones y uno con zona inválida.
const proximo = () =>
  calendarEvent("jpn", {
    round: 3,
    status: "CURRENT",
    country: { iso: "JP", name: "Japón" },
    circuit: { name: "Motegi", place: "Motegi" },
    time_zone: "ASIA/TOKYO",
    is_next_gp: true,
    sessions: [
      calSession("jpn-fp1", "FP1", "2026-05-01T08:00:00.000Z"),
      calSession("jpn-spr", "SPR", "2026-05-02T08:00:00.000Z", { category: "Moto2", category_legacy_id: 2 }),
      calSession("jpn-rac", "RAC", "2026-05-03T08:00:00.000Z"),
    ],
  });
const sinSesiones = () => calendarEvent("sin", { round: 4, sessions: [] });
const zonaInvalida = () => calendarEvent("zon", { round: 5, time_zone: "NO/EXISTE", status: "FINISHED" });

describe("CalendarView: estados (CAL-01)", () => {
  it("muestra el esqueleto mientras carga", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<CalendarView />);
    expect(screen.getByRole("status", { name: "Cargando calendario" })).toBeInTheDocument();
  });

  it("error de la API: No se ha podido cargar el calendario", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => json(500, { error: "x" })));
    render(<CalendarView />);
    expect(await screen.findByText("No se ha podido cargar el calendario")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cargando calendario" })).not.toBeInTheDocument();
  });

  it("error de red: mismo mensaje", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("sin red"))));
    render(<CalendarView />);
    expect(await screen.findByText("No se ha podido cargar el calendario")).toBeInTheDocument();
  });

  it("lista vacía: No hay Grandes Premios disponibles", async () => {
    mockCalendar([]);
    render(<CalendarView />);
    expect(await screen.findByText("No hay Grandes Premios disponibles")).toBeInTheDocument();
  });
});

describe("CalendarView: próximo GP y tarjeta (CAL-02, CAL-03)", () => {
  it("con is_next_gp sale el bloque destacado y el evento se repite en la lista", async () => {
    mockCalendar([sinSesiones(), proximo()]);
    render(<CalendarView />);
    expect(await screen.findByRole("heading", { name: "Próximo Gran Premio" })).toBeInTheDocument();
    expect(screen.getAllByText("GP jpn")).toHaveLength(2);
    expect(screen.getAllByText("GP sin")).toHaveLength(1);
  });

  it("sin is_next_gp no sale el bloque y cada evento aparece una vez", async () => {
    mockCalendar([sinSesiones(), calendarEvent("esp")]);
    render(<CalendarView />);
    expect(await screen.findByText("GP esp")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximo Gran Premio" })).not.toBeInTheDocument();
    expect(screen.getAllByText("GP esp")).toHaveLength(1);
  });

  it("la tarjeta muestra ronda, estado, circuito, país y fechas", async () => {
    mockCalendar([zonaInvalida()]);
    render(<CalendarView />);
    expect(await screen.findByText("RONDA 5")).toBeInTheDocument();
    expect(screen.getByText("Finalizado")).toBeInTheDocument();
    expect(screen.getByText("Circuito zon")).toBeInTheDocument();
    expect(screen.getByText("Lugar, España")).toBeInTheDocument();
    expect(screen.getByText("1 may 2026")).toBeInTheDocument();
    expect(screen.getByText("hasta 3 may 2026")).toBeInTheDocument();
  });

  it("estado desconocido se pinta como Próximamente", async () => {
    mockCalendar([calendarEvent("raro", { status: "CANCELLED" })]);
    render(<CalendarView />);
    expect(await screen.findByText("Próximamente")).toBeInTheDocument();
  });
});

describe("CalendarView: acordeón (CAL-04)", () => {
  it("solo las tarjetas con sesiones tienen botón; abre y cierra con aria-expanded", async () => {
    mockCalendar([sinSesiones(), calendarEvent("esp")]);
    const user = userEvent.setup();
    render(<CalendarView />);
    await screen.findByText("GP esp");

    expect(screen.getAllByRole("button", { name: /RONDA/ })).toHaveLength(1);
    const boton = screen.getByRole("button", { name: /GP esp/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    await user.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await user.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "false");
  });

  it("cada tarjeta es independiente", async () => {
    mockCalendar([calendarEvent("uno"), calendarEvent("dos")]);
    const user = userEvent.setup();
    render(<CalendarView />);
    await screen.findByText("GP uno");

    const uno = screen.getByRole("button", { name: /GP uno/ });
    const dos = screen.getByRole("button", { name: /GP dos/ });
    await user.click(uno);
    expect(uno).toHaveAttribute("aria-expanded", "true");
    expect(dos).toHaveAttribute("aria-expanded", "false");
    await user.click(dos);
    expect(uno).toHaveAttribute("aria-expanded", "true");
    expect(dos).toHaveAttribute("aria-expanded", "true");
  });

  it("la copia destacada y la de la lista no comparten ids y aria-controls apunta a su panel", async () => {
    mockCalendar([proximo()]);
    render(<CalendarView />);
    await screen.findByRole("heading", { name: "Próximo Gran Premio" });

    const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    const controls = screen
      .getAllByRole("button", { name: /GP jpn/ })
      .map((b) => b.getAttribute("aria-controls")!);
    expect(new Set(controls).size).toBe(2);
    for (const id of controls) expect(document.getElementById(id)).not.toBeNull();
  });
});

describe("CalendarView: TU HORA / HORA LOCAL (CAL-05)", () => {
  it("el conmutador es compartido entre tarjetas y cambia horas y desfase", async () => {
    mockCalendar([proximo(), calendarEvent("esp", { time_zone: "EUROPE/MADRID" })]);
    const user = userEvent.setup();
    render(<CalendarView />);
    await screen.findByRole("heading", { name: "Próximo Gran Premio" });

    const jpnLista = screen.getAllByRole("article")[1];
    // Tu hora (Europe/Madrid, CEST): 08:00Z = 10:00
    expect(within(jpnLista).getByText(/Tu hora \(UTC\+2\)/)).toBeInTheDocument();
    expect(within(jpnLista).getAllByText("10:00").length).toBeGreaterThan(0);

    await user.click(within(jpnLista).getByRole("button", { name: "HORA LOCAL" }));

    // Todas las tarjetas pasan a HORA LOCAL, no solo la pulsada.
    for (const boton of screen.getAllByRole("button", { name: "HORA LOCAL" })) {
      expect(boton).toHaveAttribute("aria-pressed", "true");
    }
    expect(screen.getAllByRole("button", { name: "TU HORA" })[0]).toHaveAttribute("aria-pressed", "false");
    // Tokio (UTC+9): 08:00Z = 17:00; Madrid (esp) sigue en UTC+2.
    expect(within(jpnLista).getByText(/Hora local del circuito \(UTC\+9\)/)).toBeInTheDocument();
    expect(within(jpnLista).getAllByText("17:00").length).toBeGreaterThan(0);
  });

  it("con zona inválida HORA LOCAL está deshabilitado, con su title, y se usa tu hora", async () => {
    mockCalendar([zonaInvalida()]);
    render(<CalendarView />);
    await screen.findByText("GP zon");

    const local = screen.getByRole("button", { name: "HORA LOCAL" });
    expect(local).toBeDisabled();
    expect(local).toHaveAttribute("title", "No se conoce la zona horaria de este circuito");
    expect(screen.getByRole("button", { name: "TU HORA" })).toHaveAttribute("aria-pressed", "true");
  });

  it("con zona válida HORA LOCAL está habilitado y explica su efecto", async () => {
    mockCalendar([proximo()]);
    render(<CalendarView />);
    await screen.findByRole("heading", { name: "Próximo Gran Premio" });
    const local = screen.getAllByRole("button", { name: "HORA LOCAL" })[0];
    expect(local).toBeEnabled();
    expect(local).toHaveAttribute("title", "Mostrar las horas en la zona horaria del circuito");
  });
});

describe("CalendarView: nombres y columnas (CAL-06, CAL-08)", () => {
  it("Sprint y Carrera en rojo; el resto no; RAC2 se llama Carrera", async () => {
    mockCalendar([
      calendarEvent("esp", {
        sessions: [
          calSession("a", "FP1", "2026-05-01T08:00:00.000Z"),
          calSession("b", "SPR", "2026-05-02T08:00:00.000Z"),
          calSession("c", "RAC2", "2026-05-03T08:00:00.000Z"),
        ],
      }),
    ]);
    render(<CalendarView />);
    await screen.findByText("GP esp");

    expect(screen.getByText("FP1")).not.toHaveClass("text-red-400");
    expect(screen.getByText("Sprint")).toHaveClass("text-red-400");
    expect(screen.getByText("Carrera")).toHaveClass("text-red-400");
  });

  it("máximo 4 columnas aunque haya más días", async () => {
    const dias = ["01", "02", "03", "04", "05"].map((d) =>
      calSession(`s${d}`, "FP1", `2026-05-${d}T08:00:00.000Z`)
    );
    mockCalendar([calendarEvent("esp", { sessions: dias })]);
    render(<CalendarView />);
    await screen.findByText("GP esp");

    const rejilla = screen.getByRole("group", { name: /Horarios de las sesiones/ });
    expect(rejilla).toHaveClass("grid-cols-4");
    expect(rejilla).not.toHaveClass("grid-cols-5");
  });
});

describe("CalendarView: pills en vivo (CAL-11)", () => {
  it("las pills cambian solas al pasar el minuto", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-05-02T10:00:00Z"));
    mockCalendar([
      calendarEvent("esp", {
        sessions: [
          calSession("a", "FP2", "2026-05-02T09:50:00.000Z", { date_end: "2026-05-02T10:00:30.000Z" }),
          calSession("b", "Q1", "2026-05-02T10:30:00.000Z", { date_end: "2026-05-02T11:00:00.000Z" }),
        ],
      }),
    ]);
    render(<CalendarView />);
    await screen.findByText("GP esp");

    expect(screen.getByText("EN VIVO")).toBeInTheDocument();
    expect(screen.queryByText("Terminada")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.queryByText("EN VIVO")).not.toBeInTheDocument();
    expect(screen.getByText("Terminada")).toBeInTheDocument();
  });
});
