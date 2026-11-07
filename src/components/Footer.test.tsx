// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Footer from "./Footer";

describe("Footer (GLB-04)", () => {
  it("muestra 'No afiliado a MotoGP' y el nombre del sitio", () => {
    render(<Footer />);
    const pie = screen.getByRole("contentinfo");
    expect(pie).toHaveTextContent("No afiliado a MotoGP");
    expect(pie).toHaveTextContent("Rebufo");
    expect(pie).toHaveTextContent("Proyecto personal sin ánimo de lucro");
  });

  it("'Aviso legal' enlaza a /aviso-legal", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Aviso legal" })).toHaveAttribute("href", "/aviso-legal");
  });
});
