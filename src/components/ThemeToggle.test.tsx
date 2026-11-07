// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ThemeToggle (GLB-05)", () => {
  it("claro por defecto: ofrece pasar a oscuro", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Cambiar a modo oscuro");
  });

  it("respeta el tema oscuro que dejó el script de layout", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Cambiar a modo claro");
  });

  it("al pulsar cambia el tema, la etiqueta y lo recuerda", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(await screen.findByRole("button", { name: "Cambiar a modo claro" })).toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(await screen.findByRole("button", { name: "Cambiar a modo oscuro" })).toBeInTheDocument();
  });

  it("sin localStorage (navegación privada) el cambio de tema sigue funcionando", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    expect(await screen.findByRole("button", { name: "Cambiar a modo claro" })).toBeInTheDocument();
  });
});
