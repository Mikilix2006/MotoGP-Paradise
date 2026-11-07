// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextGrandPrix } from "../NextGrandPrix";
import { nextGp, nextGpSinFecha, nextGpSinRonda } from "./__fixtures__/nextGp";
import { mockFetch, ok } from "./__fixtures__/mockFetch";

class Limite extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? <p>La página se ha roto</p> : this.props.children;
  }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NextGrandPrix", () => {
  it("INI-01: muestra nombre, ronda, estado, circuito, lugar, fechas y bandera", async () => {
    mockFetch({ "/api/next-gp": ok(nextGp) });
    render(<NextGrandPrix />);

    expect(await screen.findByRole("heading", { name: "Gran Premio de Qatar" })).toBeInTheDocument();
    expect(screen.getByText("RONDA 2")).toBeInTheDocument();
    expect(screen.getByText("QAT")).toBeInTheDocument();
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    expect(screen.getByText("Lusail International Circuit")).toBeInTheDocument();
    expect(screen.getByText("Lusail, Qatar")).toBeInTheDocument();
    expect(screen.getByText("6 de marzo de 2026")).toBeInTheDocument();
    expect(screen.getByText("Finaliza el 8 de marzo de 2026")).toBeInTheDocument();
    expect(screen.getByAltText("Bandera de Qatar")).toBeInTheDocument();
    expect(screen.getByText("Circuito de Lusail")).toBeInTheDocument();
  });

  it("INI-01: usa el nombre corto si no hay nombre patrocinado y traduce el estado", async () => {
    mockFetch({ "/api/next-gp": ok({ ...nextGp, sponsored_name: "", status: "CURRENT" }) });
    render(<NextGrandPrix />);

    expect(await screen.findByRole("heading", { name: "Qatar" })).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  // INI-01: sin ronda salen dos etiquetas iguales (NextGrandPrix.tsx:~140-146, `round ? ... : short_name` junto a `short_name`).
  it.fails("SOSPECHA: sin ronda el nombre corto no se repite dos veces (INI-01)", async () => {
    mockFetch({ "/api/next-gp": ok(nextGpSinRonda) });
    render(<NextGrandPrix />);

    await screen.findByRole("heading", { name: "Gran Premio de Qatar" });
    expect(screen.queryByText(/RONDA/)).not.toBeInTheDocument();
    expect(screen.getAllByText("QAT")).toHaveLength(1);
  });

  // INI-02: confirmada, formatDate("") lanza RangeError durante el render y rompe la página.
  it.fails("SOSPECHA: con date_start vacío la tarjeta se pinta igualmente (INI-02)", async () => {
    mockFetch({ "/api/next-gp": ok(nextGpSinFecha) });
    // Con límite de errores, la excepción de render no llega como error no capturado.
    render(
      <Limite>
        <NextGrandPrix />
      </Limite>
    );

    expect(await screen.findByRole("heading", { name: "Gran Premio de Qatar" })).toBeInTheDocument();
  });

  it("INI-03: mientras carga muestra el esqueleto accesible", () => {
    mockFetch({ "/api/next-gp": "pendiente" });
    render(<NextGrandPrix />);

    expect(screen.getByRole("status", { name: "Cargando próximo Gran Premio" })).toBeInTheDocument();
  });

  it.each([404, 500])("INI-03: error con estado %i", async (status) => {
    mockFetch({ "/api/next-gp": { status, body: { error: "x" } } });
    render(<NextGrandPrix />);

    expect(await screen.findByText("No se ha podido cargar la información del próximo GP")).toBeInTheDocument();
    expect(screen.getByText("Inténtalo de nuevo más tarde.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
