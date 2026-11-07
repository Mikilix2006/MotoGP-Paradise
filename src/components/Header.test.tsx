// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

// jsdom no implementa matchMedia (lo usa el cierre del menú al pasar a escritorio).
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

import { Header, isActive } from "./Header";

describe("isActive (GLB-01)", () => {
  it("'/' solo en la portada exacta", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/calendario")).toBe(false);
  });

  it("las demás rutas también en sus subrutas, sin falsos prefijos", () => {
    expect(isActive("/resultados", "/resultados")).toBe(true);
    expect(isActive("/resultados", "/resultados/2026")).toBe(true);
    expect(isActive("/resultados", "/resultadosx")).toBe(false);
  });

  it("'#' nunca está activo", () => {
    expect(isActive("#", "/")).toBe(false);
  });
});

describe("Header", () => {
  it("enlaces del menú y logo hacia sus rutas; el activo lleva aria-current (GLB-01, GLB-03)", () => {
    pathname = "/calendario";
    render(<Header />);

    expect(screen.getByRole("link", { name: "Rebufo, ir al inicio" })).toHaveAttribute("href", "/");

    const [desktop] = screen.getAllByRole("navigation", { name: "Menú principal" });
    const links = within(desktop).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Inicio", "/"],
      ["Calendario", "/calendario"],
      ["Resultados", "/resultados"],
      ["Predicciones", "#"],
    ]);
    expect(within(desktop).getByRole("link", { name: "Calendario" })).toHaveAttribute("aria-current", "page");
    expect(within(desktop).getByRole("link", { name: "Predicciones" })).not.toHaveAttribute("aria-current");
  });

  it("menú móvil: abre, Escape cierra y devuelve el foco al botón (GLB-02)", async () => {
    pathname = "/";
    const user = userEvent.setup();
    render(<Header />);

    const button = screen.getByRole("button", { name: "Abrir menú" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAccessibleName("Cerrar menú");

    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });
});
