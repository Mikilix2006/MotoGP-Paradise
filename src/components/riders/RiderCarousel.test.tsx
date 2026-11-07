// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { RiderCarousel } from "./RiderCarousel";
import { piloto, respuesta } from "./__fixtures__/pilotos";

const tres = () =>
  respuesta([
    piloto({ id: "a", full_name: "Piloto A" }),
    piloto({ id: "b", full_name: "Piloto B" }),
    piloto({ id: "c", full_name: "Piloto C" }),
  ]);

function montar(data = tres(), extra: Partial<React.ComponentProps<typeof RiderCarousel>> = {}) {
  const props = { onCategoryChange: vi.fn(), onRetry: vi.fn(), onImageIssue: vi.fn() };
  render(<RiderCarousel status="ready" data={data} category={data.category} {...props} {...extra} />);
  return { ...props, user: userEvent.setup() };
}

const nombre = () => screen.getByRole("heading", { level: 2 }).textContent;
const carrusel = () => screen.getByRole("region", { name: "Pilotos de MotoGP, temporada 2026" });
const siguiente = () => screen.getByRole("button", { name: "Piloto siguiente" });
const anterior = () => screen.getByRole("button", { name: "Piloto anterior" });

describe("RiderCarousel: flechas (PIL-03)", () => {
  it("muestra el primer piloto y el contador '1 / 3'", () => {
    montar();
    expect(nombre()).toBe("Piloto A");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "1 de 3" })).toBeInTheDocument();
  });

  it("siguiente y anterior avanzan; es circular en ambos sentidos", async () => {
    const { user } = montar();
    await user.click(siguiente());
    expect(nombre()).toBe("Piloto B");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await user.click(siguiente());
    await user.click(siguiente());
    expect(nombre()).toBe("Piloto A");
    await user.click(anterior());
    expect(nombre()).toBe("Piloto C");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("un solo piloto: flechas deshabilitadas y contador '1 / 1'", () => {
    montar(respuesta([piloto()]));
    expect(siguiente()).toBeDisabled();
    expect(anterior()).toBeDisabled();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("anuncia el piloto actual a lectores de pantalla", async () => {
    const { user } = montar();
    await user.click(siguiente());
    expect(screen.getByText("Piloto 2 de 3: Piloto B")).toBeInTheDocument();
  });
});

describe("RiderCarousel: teclado (PIL-03)", () => {
  it("←/→ cambian de piloto, de forma circular, y recogen el foco en el carrusel", async () => {
    const { user } = montar();
    carrusel().focus();
    await user.keyboard("{ArrowRight}");
    expect(nombre()).toBe("Piloto B");
    expect(carrusel()).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(nombre()).toBe("Piloto C");
  });

  it.each(["Shift", "Control", "Alt", "Meta"])("con %s pulsado se ignoran", async (mod) => {
    const { user } = montar();
    carrusel().focus();
    await user.keyboard(`{${mod}>}{ArrowRight}{/${mod}}`);
    expect(nombre()).toBe("Piloto A");
  });

  it("otras teclas no hacen nada", async () => {
    const { user } = montar();
    carrusel().focus();
    await user.keyboard("{ArrowDown}a");
    expect(nombre()).toBe("Piloto A");
  });

  it("con un solo piloto, ←/→ no hacen nada", async () => {
    const { user } = montar(respuesta([piloto({ full_name: "Solo" })]));
    carrusel().focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(nombre()).toBe("Solo");
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("las flechas dentro de las pestañas de la ficha no cambian de piloto", async () => {
    const { user } = montar();
    screen.getByRole("tab", { name: "Temporada" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Victorias y poles" })).toHaveAttribute("aria-selected", "true");
    expect(nombre()).toBe("Piloto A");
  });

  it("la pestaña elegida se conserva al pasar al siguiente piloto", async () => {
    const { user } = montar();
    await user.click(screen.getByRole("tab", { name: "Mundiales" }));
    await user.click(siguiente());
    expect(nombre()).toBe("Piloto B");
    expect(screen.getByRole("tab", { name: "Mundiales" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("RiderCarousel: estados y categoría", () => {
  it("cargando: esqueleto accesible", () => {
    montar(undefined, { status: "loading", data: null });
    expect(screen.getByRole("status", { name: "Cargando pilotos" })).toBeInTheDocument();
  });

  it("datos de otra categoría se tratan como carga", () => {
    montar(respuesta([piloto()], "Moto2"), { category: "MotoGP" });
    expect(screen.getByRole("status", { name: "Cargando pilotos" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("error con 'Reintentar'", async () => {
    const { user, onRetry } = montar(undefined, { status: "error", data: null });
    expect(screen.getByRole("alert")).toHaveTextContent("No se han podido cargar los pilotos de MotoGP");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("vacío: texto con categoría y temporada", () => {
    montar(respuesta([], "Moto3"));
    expect(screen.getByText("Todavía no hay pilotos de Moto3 registrados en la temporada 2026.")).toBeInTheDocument();
  });

  it("selector de categoría: Moto3, Moto2, MotoGP; activa marcada y pulsarla no avisa", async () => {
    const { user, onCategoryChange } = montar();
    const grupo = screen.getByRole("group", { name: "Categoría" });
    expect(Array.from(grupo.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Moto3", "Moto2", "MotoGP"]);
    expect(screen.getByRole("button", { name: "MotoGP" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "MotoGP" }));
    expect(onCategoryChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Moto2" }));
    expect(onCategoryChange).toHaveBeenCalledWith("Moto2");
  });

  it("el aviso de imagen ausente se envía una sola vez por piloto aunque se vuelva a él", async () => {
    const data = respuesta([piloto({ id: "a", image_url: null }), piloto({ id: "b", image_url: null })]);
    const { user, onImageIssue } = montar(data);
    expect(onImageIssue).toHaveBeenCalledTimes(1);
    await user.click(siguiente());
    expect(onImageIssue).toHaveBeenCalledTimes(2);
    await user.click(siguiente());
    expect(onImageIssue).toHaveBeenCalledTimes(2);
  });
});
