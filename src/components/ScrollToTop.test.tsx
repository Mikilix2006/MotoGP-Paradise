// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScrollToTop from "./ScrollToTop";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

let reducedMotion = false;
beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn(() => ({ matches: reducedMotion })) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});
afterEach(() => {
  reducedMotion = false;
});

const boton = () => screen.getByRole("button", { name: "Volver arriba" });

describe("ScrollToTop (GLB-06)", () => {
  it("arriba del todo está oculto y fuera del orden de tabulación", () => {
    render(<ScrollToTop />);
    expect(boton()).toHaveAttribute("tabindex", "-1");
    expect(boton()).toHaveClass("opacity-0", "pointer-events-none");
  });

  it("aparece al bajar más de 300 px (300 exactos, no)", () => {
    render(<ScrollToTop />);
    scrollTo(300);
    expect(boton()).toHaveAttribute("tabindex", "-1");
    scrollTo(301);
    expect(boton()).toHaveAttribute("tabindex", "0");
    expect(boton()).toHaveClass("opacity-100");
    scrollTo(10);
    expect(boton()).toHaveAttribute("tabindex", "-1");
  });

  it("ya visible al montar si la página está bajada", () => {
    Object.defineProperty(window, "scrollY", { value: 900, configurable: true });
    render(<ScrollToTop />);
    expect(boton()).toHaveClass("opacity-100");
  });

  it("al pulsar sube con scroll suave", async () => {
    render(<ScrollToTop />);
    scrollTo(500);
    await userEvent.setup().click(boton());
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("con movimiento reducido sube sin animación", async () => {
    reducedMotion = true;
    render(<ScrollToTop />);
    scrollTo(500);
    await userEvent.setup().click(boton());
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("al desmontar deja de escuchar el scroll", () => {
    const quitar = vi.spyOn(window, "removeEventListener");
    render(<ScrollToTop />).unmount();
    expect(quitar).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
