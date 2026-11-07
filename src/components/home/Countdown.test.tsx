// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "../Countdown";

const ahora = new Date("2026-03-01T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ahora);
});

afterEach(() => vi.useRealTimers());

// Los cuatro dígitos en orden: días, horas, minutos, segundos.
const digitos = () => [...document.querySelectorAll("p.tabular-nums")].map((p) => p.textContent?.trim());

describe("Countdown (INI-04)", () => {
  it("pinta los dígitos a dos cifras", () => {
    // 1 d 2 h 3 min 4 s
    const objetivo = new Date(ahora.getTime() + (((24 + 2) * 60 + 3) * 60 + 4) * 1000).toISOString();
    render(<Countdown targetDate={objetivo} />);

    expect(digitos()).toEqual(["01", "02", "03", "04"]);
  });

  it("baja cada segundo", () => {
    const objetivo = new Date(ahora.getTime() + 65_000).toISOString();
    render(<Countdown targetDate={objetivo} />);
    expect(digitos()).toEqual(["00", "00", "01", "05"]);

    act(() => void vi.advanceTimersByTime(1000));
    expect(digitos()).toEqual(["00", "00", "01", "04"]);

    act(() => void vi.advanceTimersByTime(5000));
    expect(digitos()).toEqual(["00", "00", "00", "59"]);
  });

  it("se queda en 00 al llegar y no pasa a negativos", () => {
    const objetivo = new Date(ahora.getTime() + 2000).toISOString();
    render(<Countdown targetDate={objetivo} />);

    act(() => void vi.advanceTimersByTime(10_000));
    expect(digitos()).toEqual(["00", "00", "00", "00"]);
  });

  it("tiene etiquetas largas y cortas (las cortas para móvil)", () => {
    render(<Countdown targetDate={ahora.toISOString()} />);

    for (const texto of ["Días", "Horas", "Min", "Minutos", "Seg", "Segundos"]) {
      expect(screen.getByText(texto)).toBeInTheDocument();
    }
    expect(screen.getByText("Min")).toHaveClass("sm:hidden");
    expect(screen.getByText("Minutos")).toHaveClass("hidden", "sm:inline");
  });
});
