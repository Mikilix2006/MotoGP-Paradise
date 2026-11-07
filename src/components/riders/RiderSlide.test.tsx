// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// next/image resuelve el loader y los hosts permitidos: aquí basta una img normal.
vi.mock("next/image", () => ({
  default: ({ src, alt, onLoad, onError }: { src: string; alt: string; onLoad?: () => void; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onLoad={onLoad} onError={onError} />
  ),
}));

import { RiderSlide } from "./RiderSlide";
import { piloto } from "./__fixtures__/pilotos";

afterEach(() => vi.useRealTimers());

function montar(rider = piloto(), onImageIssue = vi.fn()) {
  render(
    <RiderSlide rider={rider} season={2026} category="MotoGP" priority={false} tab="season" onTabChange={vi.fn()} onImageIssue={onImageIssue} />
  );
  return onImageIssue;
}

describe("RiderSlide: identidad (PIL-04)", () => {
  it("nombre, dorsal, país, marca y equipo", () => {
    montar();
    expect(screen.getByRole("heading", { level: 2, name: "Piloto Uno" })).toBeInTheDocument();
    expect(screen.getByText("#93")).toBeInTheDocument();
    expect(screen.getByText("España")).toBeInTheDocument();
    expect(screen.getByText("Ducati")).toBeInTheDocument();
    expect(screen.getByText("Equipo Rojo")).toBeInTheDocument();
  });

  it("sin equipo: 'Sin equipo'; sin dorsal, país ni marca no salen sus pills", () => {
    montar(piloto({ team: null, number: null, country: null, constructor_name: null }));
    expect(screen.getByText("Sin equipo")).toBeInTheDocument();
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    expect(screen.queryByText("España")).not.toBeInTheDocument();
    expect(screen.queryByText("Ducati")).not.toBeInTheDocument();
  });

  it("color de equipo visible se aplica a la barra; el casi negro se ignora", () => {
    const { unmount } = render(
      <RiderSlide rider={piloto()} season={2026} category="MotoGP" priority={false} tab="season" onTabChange={vi.fn()} onImageIssue={vi.fn()} />
    );
    expect(screen.getByText("Equipo Rojo").previousElementSibling).toHaveStyle({ backgroundColor: "#ad0000" });
    unmount();

    montar(piloto({ team: { name: "Equipo Gris", color: "#262626", text_color: null } }));
    const barra = screen.getByText("Equipo Gris").previousElementSibling!;
    expect(barra).toHaveClass("bg-red-600");
    expect(barra).not.toHaveAttribute("style");
  });
});

describe("RiderSlide: imagen (PIL-04)", () => {
  it("con imagen la pinta con su texto alternativo y no avisa", () => {
    const aviso = montar();
    expect(screen.getByRole("img", { name: "Retrato de Piloto Uno" })).toHaveAttribute("src", "https://photos.motogp.com/uno.png");
    expect(screen.queryByText("Imagen del piloto no disponible")).not.toBeInTheDocument();
    expect(aviso).not.toHaveBeenCalled();
  });

  it("sin imagen: 'Imagen del piloto no disponible' y avisa una vez con motivo 'null'", () => {
    const aviso = montar(piloto({ image_url: null }));
    expect(screen.getByText("Imagen del piloto no disponible")).toBeInTheDocument();
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }), "null");
  });

  it("si la imagen falla al cargar, cambia al texto y avisa con motivo 'error'", () => {
    const aviso = montar();
    fireEvent.error(screen.getByRole("img", { name: "Retrato de Piloto Uno" }));
    expect(screen.getByText("Imagen del piloto no disponible")).toBeInTheDocument();
    expect(aviso).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }), "error");
  });

  it("mientras carga, 'Cargando…' hasta el evento load", () => {
    montar();
    expect(screen.getByRole("status", { name: "Cargando imagen del piloto" })).toBeInTheDocument();
    fireEvent.load(screen.getByRole("img", { name: "Retrato de Piloto Uno" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("RiderSlide: biografía (PIL-04)", () => {
  it("biografía corta: sin botón 'Leer más'", () => {
    montar(piloto({ biography: "x".repeat(280) }));
    expect(screen.queryByRole("button", { name: /Leer/ })).not.toBeInTheDocument();
  });

  it("biografía larga: 'Leer más' despliega y 'Leer menos' recoge", async () => {
    const user = userEvent.setup();
    montar(piloto({ biography: "Primer párrafo. ".repeat(30) + "\n\nSegundo párrafo." }));
    const boton = screen.getByRole("button", { name: /Leer más/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Segundo párrafo.")).not.toBeInTheDocument();

    await user.click(boton);
    expect(screen.getByRole("button", { name: /Leer menos/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Segundo párrafo.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Leer menos/ }));
    expect(screen.getByRole("button", { name: /Leer más/ })).toBeInTheDocument();
  });

  it("sin biografía: descripción de reserva con la edad en el día del cumpleaños", () => {
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date(2026, 1, 17, 12));
    montar(piloto({ biography: null }));
    expect(screen.getByText(/33 años/)).toBeInTheDocument();
    expect(screen.getByText(/Dorsal #93 · España/)).toBeInTheDocument();
  });

  it("el día antes del cumpleaños aún no ha cumplido", () => {
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date(2026, 1, 16, 12));
    montar(piloto({ biography: "  " }));
    expect(screen.getByText(/32 años/)).toBeInTheDocument();
  });

  it("sin biografía ni datos para la reserva: mensaje vacío", () => {
    montar(
      piloto({ biography: null, number: null, country: null, birth_date: null, birth_city: null, team: null, constructor_name: null })
    );
    expect(screen.getByText("Todavía no hay descripción de este piloto.")).toBeInTheDocument();
  });
});
