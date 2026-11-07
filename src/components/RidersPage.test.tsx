// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import RidersPage from "./RidersPage";
import { piloto, respuesta } from "./riders/__fixtures__/pilotos";

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const porCategoria = {
  MotoGP: respuesta([piloto({ id: "g1", full_name: "Piloto GP Uno" }), piloto({ id: "g2", full_name: "Piloto GP Dos" })]),
  Moto2: respuesta([piloto({ id: "m1", full_name: "Piloto Moto2 Uno" })], "Moto2"),
  Moto3: respuesta([piloto({ id: "t1", full_name: "Piloto Moto3 Uno" })], "Moto3"),
};

function fetchPorCategoria() {
  return vi.fn((url: string) => {
    const cat = new URL(url, "http://x").searchParams.get("category") as keyof typeof porCategoria;
    return json(200, { data: porCategoria[cat] });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("RidersPage (PIL-02)", () => {
  it("categoría por defecto MotoGP", async () => {
    const fetchMock = fetchPorCategoria();
    vi.stubGlobal("fetch", fetchMock);
    render(<RidersPage />);

    expect(screen.getByRole("status", { name: "Cargando pilotos" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Piloto GP Uno" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/riders/carousel?category=MotoGP", expect.anything());
    expect(screen.getByRole("button", { name: "MotoGP" })).toHaveAttribute("aria-pressed", "true");
  });

  it("al cambiar a Moto2 y Moto3 pide esa categoría y vuelve al primer piloto", async () => {
    const fetchMock = fetchPorCategoria();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RidersPage />);
    await screen.findByRole("heading", { level: 2, name: "Piloto GP Uno" });

    await user.click(screen.getByRole("button", { name: "Piloto siguiente" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Piloto GP Dos");

    await user.click(screen.getByRole("button", { name: "Moto2" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Piloto Moto2 Uno" })).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Moto3" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Piloto Moto3 Uno" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/riders/carousel?category=MotoGP",
      "/api/riders/carousel?category=Moto2",
      "/api/riders/carousel?category=Moto3",
    ]);
  });

  it("volver a MotoGP empieza otra vez por el primer piloto", async () => {
    vi.stubGlobal("fetch", fetchPorCategoria());
    const user = userEvent.setup();
    render(<RidersPage />);
    await screen.findByRole("heading", { level: 2, name: "Piloto GP Uno" });
    await user.click(screen.getByRole("button", { name: "Piloto siguiente" }));

    await user.click(screen.getByRole("button", { name: "Moto2" }));
    await screen.findByRole("heading", { level: 2, name: "Piloto Moto2 Uno" });
    await user.click(screen.getByRole("button", { name: "MotoGP" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Piloto GP Uno" })).toBeInTheDocument();
  });

  it("error de la API: mensaje y 'Reintentar' se recupera", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => json(500, { error: "fallo" }))
      .mockImplementationOnce(() => json(200, { data: porCategoria.MotoGP }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RidersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se han podido cargar los pilotos de MotoGP");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Piloto GP Uno" })).toBeInTheDocument();
  });

  it("un piloto sin imagen se notifica por POST a /api/dev/image-issue (solo desarrollo)", async () => {
    const sinImagen = respuesta([piloto({ id: "s1", full_name: "Sin Foto", image_url: null })]);
    const fetchMock = vi.fn((url: string) => json(200, url.startsWith("/api/riders") ? { data: sinImagen } : {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<RidersPage />);
    await screen.findByText("Imagen del piloto no disponible");

    const post = fetchMock.mock.calls.find((c) => c[0] === "/api/dev/image-issue") as unknown as [string, RequestInit];
    expect(post[1].method).toBe("POST");
    expect(JSON.parse(post[1].body as string)).toMatchObject({ rider_id: "s1", full_name: "Sin Foto", reason: "null" });
  });
});
