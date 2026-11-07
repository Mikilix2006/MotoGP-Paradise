// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import GrandPrixFavorites from "../GrandPrixFavorites";
import {
  favoritosMuchos,
  favoritosPocos,
  favoritosSinHistorial,
  favoritosVacios,
} from "./__fixtures__/favorites";
import { mockFetch, ok } from "./__fixtures__/mockFetch";

const URL_FAVORITOS = "/api/next-gp/favorites";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const boton = (nombre: string) => screen.getByText(nombre).closest("button") as HTMLButtonElement;

async function abrir(data: unknown, ...pilotos: string[]) {
  mockFetch({ [URL_FAVORITOS]: ok(data) });
  const user = userEvent.setup();
  render(<GrandPrixFavorites />);
  await screen.findByText(pilotos[0] ?? "Piloto 1");
  for (const p of pilotos) await user.click(boton(p));
  return user;
}

describe("GrandPrixFavorites: lista", () => {
  it("INI-11: con más de 5 muestra 5 filas y el botón de la parrilla completa", async () => {
    const user = await abrir(favoritosMuchos);

    expect(screen.getByText("Piloto 5")).toBeInTheDocument();
    expect(screen.queryByText("Piloto 6")).not.toBeInTheDocument();
    expect(screen.getByText("Lusail International Circuit")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver toda la parrilla (7)" }));
    expect(screen.getByText("Piloto 7")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver solo los favoritos" }));
    expect(screen.queryByText("Piloto 6")).not.toBeInTheDocument();
  });

  it("INI-11: con 5 o menos no hay botón", async () => {
    await abrir(favoritosPocos);

    expect(screen.getAllByText(/^Piloto \d$/)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /parrilla|solo los favoritos/ })).not.toBeInTheDocument();
  });

  it("INI-11: puntuación, probabilidad y rango a dos cifras en cada fila", async () => {
    await abrir(favoritosPocos);

    expect(within(boton("Piloto 1")).getByText("01")).toBeInTheDocument();
    expect(within(boton("Piloto 1")).getByText("79/100")).toBeInTheDocument();
    expect(within(boton("Piloto 1")).getByText("19% victoria")).toBeInTheDocument();
  });

  it("INI-11: solo hay una fila abierta a la vez", async () => {
    const user = await abrir(favoritosMuchos, "Piloto 1");
    expect(boton("Piloto 1")).toHaveAttribute("aria-expanded", "true");

    await user.click(boton("Piloto 2"));
    expect(boton("Piloto 1")).toHaveAttribute("aria-expanded", "false");
    expect(boton("Piloto 2")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("En este circuito")).toHaveLength(1);

    await user.click(boton("Piloto 2"));
    expect(screen.queryByText("En este circuito")).not.toBeInTheDocument();
  });
});

describe("GrandPrixFavorites: detalle (INI-12)", () => {
  it("muestra las barras de los 5 factores con su valor", async () => {
    await abrir(favoritosPocos, "Piloto 1");

    for (const [etiqueta, valor] of [
      ["Circuito", "55"],
      ["Forma", "70"],
      ["Moto", "90"],
      ["Fiabilidad", "88"],
      ["Tendencia", "70"],
    ]) {
      const fila = screen.getByText(etiqueta).parentElement!;
      expect(within(fila).getByText(valor)).toBeInTheDocument();
    }
  });

  it("estadísticas del circuito y de la temporada", async () => {
    await abrir(favoritosPocos, "Piloto 1");

    expect(screen.getByText("Carreras")).toBeInTheDocument();
    expect(screen.getByText("4.5º")).toBeInTheDocument();
    expect(screen.getByText(/Credibilidad del historial:/)).toHaveTextContent("50%");
    expect(screen.getByText(/5 carreras · 1 victorias · 3 podios · media 3.2º · termina el 90%/)).toBeInTheDocument();
  });

  it("pills del historial: sprint con 'S', abandono con DNF y podio destacado", async () => {
    await abrir(favoritosPocos, "Piloto 1");

    const carrera = screen.getByTitle("2025 · Carrera");
    expect(carrera).toHaveTextContent("252º");
    expect(carrera.className).toContain("border-white/20");

    const sprint = screen.getByTitle("2025 · Sprint");
    expect(sprint).toHaveTextContent("25S5º");

    const abandono = screen.getByTitle("2024 · Carrera");
    expect(abandono).toHaveTextContent("24DNF");
    expect(abandono.className).toContain("text-red-400");
  });

  it("bloque de la moto con el constructor, el año anterior y la mejora", async () => {
    await abrir(favoritosPocos, "Piloto 1");

    expect(screen.getByText("La moto · Ducati")).toBeInTheDocument();
    expect(screen.getByText("(5º en 2025)")).toBeInTheDocument();
    expect(screen.getByText("+2 puestos")).toHaveClass("text-emerald-400");
    expect(screen.getByText("4º típico")).toBeInTheDocument();
  });

  it("sin historial en el circuito: texto alternativo, sin pills y sin constructor sin moto", async () => {
    await abrir(favoritosSinHistorial, "Piloto 1");

    expect(screen.getByText(/Sin carreras de MotoGP aquí/)).toBeInTheDocument();
    expect(screen.queryByText("Credibilidad del historial:")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Carrera|Sprint/)).not.toBeInTheDocument();
    expect(screen.queryByText(/La moto ·/)).not.toBeInTheDocument();
  });

  it("tendencia: 'va a más' si es positiva, 'va a menos' si es negativa y nada si es cero", async () => {
    const user = await abrir(favoritosSinHistorial, "Piloto 1");
    expect(screen.queryByText("va a más")).not.toBeInTheDocument();
    expect(screen.queryByText("va a menos")).not.toBeInTheDocument();

    await user.click(boton("Piloto 2"));
    expect(screen.getByText("va a menos")).toHaveClass("text-red-400");
  });

  it("'va a más' con tendencia positiva", async () => {
    await abrir(favoritosPocos, "Piloto 1");
    expect(screen.getByText("va a más")).toHaveClass("text-emerald-400");
  });
});

describe("GrandPrixFavorites: estados (INI-13)", () => {
  it("cargando muestra el esqueleto", () => {
    mockFetch({ [URL_FAVORITOS]: "pendiente" });
    render(<GrandPrixFavorites />);

    expect(screen.getByRole("status", { name: "Cargando favoritos" })).toBeInTheDocument();
  });

  it("404 muestra el error", async () => {
    mockFetch({ [URL_FAVORITOS]: { status: 404, body: { error: "x" } } });
    render(<GrandPrixFavorites />);

    expect(await screen.findByText("No se pudieron calcular los favoritos")).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay datos/)).not.toBeInTheDocument();
  });

  it("200 sin favoritos muestra el mensaje de vacío", async () => {
    mockFetch({ [URL_FAVORITOS]: ok(favoritosVacios) });
    render(<GrandPrixFavorites />);

    expect(await screen.findByText("Todavía no hay datos suficientes para este GP.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
