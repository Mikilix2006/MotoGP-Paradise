import { vi } from "vitest";

type Ruta = { status?: number; body?: unknown } | "pendiente";

// fetch simulado por endpoint; las rutas sin definir devuelven 404. "pendiente" no resuelve nunca.
export function mockFetch(rutas: Record<string, Ruta>) {
  const mock = vi.fn((url: string) => {
    const ruta = rutas[url];
    if (ruta === "pendiente") return new Promise<Response>(() => {});
    if (!ruta) return Promise.resolve(new Response("{}", { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(ruta.body ?? {}), { status: ruta.status ?? 200 }));
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

export const ok = (data: unknown) => ({ status: 200, body: { data } });
