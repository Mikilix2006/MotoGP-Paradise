// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/ruta-inventada" }));

// jsdom no implementa matchMedia (lo usa el menú de la cabecera).
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

import NotFound from "./not-found";

describe("not-found (GLB-07)", () => {
  it("muestra el error 404 y el titular", () => {
    render(<NotFound />);
    expect(screen.getByText("Error 404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Te has salido de la trazada" })).toBeInTheDocument();
    expect(screen.getByText(/La página que buscas no existe o ha cambiado de sitio/)).toBeInTheDocument();
  });

  it("'Volver al inicio' lleva a /", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });

  it("incluye la cabecera con el menú", () => {
    render(<NotFound />);
    expect(screen.getAllByRole("link", { name: "Resultados" })[0]).toHaveAttribute("href", "/resultados");
  });
});
