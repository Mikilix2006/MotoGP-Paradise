import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSesion = vi.fn();
const update = vi.fn();
const verifyTOTP = vi.fn();
const verifyBackupCode = vi.fn();
const deleteUser = vi.fn();

vi.mock("@/lib/session", async () => {
  const real = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return { ...real, getSesion: () => getSesion() };
});
vi.mock("@/lib/prisma", () => ({ prisma: { authUser: { update: (...a: unknown[]) => update(...a) } } }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { verifyTOTP, verifyBackupCode, deleteUser } }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { POST as eliminar } from "./eliminar/route";
import { DELETE as borrarColor, PUT as guardarColor } from "./color/route";
import { GET as estado } from "./estado/route";

const json = (method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/cuenta/x", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const sesion = (extra: Record<string, unknown> = {}) => ({
  user: { id: "u1", name: "ana", username: "ana", displayUsername: "Ana", email: "ana@x.es", accentColor: null, twoFactorEnabled: false, ...extra },
});

beforeEach(() => {
  vi.stubEnv("REGISTRO_ABIERTO", "true");
  getSesion.mockResolvedValue(sesion());
  deleteUser.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("interruptor REGISTRO_ABIERTO", () => {
  it("apagado: estado dice cerrado y las rutas que cambian datos dan 404 sin tocar nada", async () => {
    vi.stubEnv("REGISTRO_ABIERTO", "false");
    expect(await (await estado()).json()).toEqual({ data: { abierto: false, usuario: null } });
    expect((await guardarColor(json("PUT", { color: "#112233" }))).status).toBe(404);
    expect((await eliminar(json("POST", { password: "x" }))).status).toBe(404);
    expect(getSesion).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("por defecto (variable sin definir) también está cerrado", async () => {
    vi.stubEnv("REGISTRO_ABIERTO", "");
    expect((await (await estado()).json()).data.abierto).toBe(false);
  });
});

describe("GET /api/cuenta/estado", () => {
  it("sin sesión: abierto y usuario null", async () => {
    getSesion.mockResolvedValue(null);
    expect(await (await estado()).json()).toEqual({ data: { abierto: true, usuario: null } });
  });

  it("con sesión: alias, correo y tokens del color, sin datos internos", async () => {
    getSesion.mockResolvedValue(sesion({ accentColor: "#1e90ff", twoFactorEnabled: true }));
    const { data } = await (await estado()).json();
    expect(data.usuario).toMatchObject({ alias: "Ana", email: "ana@x.es", color: "#1e90ff", dosFactores: true });
    expect(data.usuario.tokens).toHaveProperty("light");
    expect(JSON.stringify(data)).not.toContain("u1"); // el id no sale
  });

  it("si leer la sesión falla, no rompe la página: usuario null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getSesion.mockRejectedValue(new Error("bd caída"));
    expect((await (await estado()).json()).data.usuario).toBeNull();
  });
});

describe("color", () => {
  it("PUT valida #rrggbb y guarda normalizado en minúsculas", async () => {
    const res = await guardarColor(json("PUT", { color: "#1E90FF" }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { accentColor: "#1e90ff" } });
  });

  it.each([{ color: "azul" }, { color: "#fff" }, { color: 123 }, {}, null])("PUT rechaza %j", async (body) => {
    expect((await guardarColor(json("PUT", body))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("sin sesión da 401 y desde otro origen 403", async () => {
    getSesion.mockResolvedValue(null);
    expect((await guardarColor(json("PUT", { color: "#112233" }))).status).toBe(401);
    getSesion.mockResolvedValue(sesion());
    expect((await guardarColor(json("PUT", { color: "#112233" }, { Origin: "https://malo.example" }))).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("DELETE restablece el rojo (null)", async () => {
    expect((await borrarColor(json("DELETE"))).status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { accentColor: null } });
  });
});

describe("POST /api/cuenta/eliminar", () => {
  it("sin sesión: 401; sin contraseña: 400; nada se borra", async () => {
    getSesion.mockResolvedValue(null);
    expect((await eliminar(json("POST", { password: "x" }))).status).toBe(401);
    getSesion.mockResolvedValue(sesion());
    expect((await eliminar(json("POST", {}))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("sin 2FA basta la contraseña", async () => {
    const res = await eliminar(json("POST", { password: "secreta-larga" }));
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(expect.objectContaining({ body: { password: "secreta-larga" } }));
    expect(verifyTOTP).not.toHaveBeenCalled();
  });

  it("con 2FA exige código: sin él no borra; con TOTP válido borra; con uno falso no", async () => {
    getSesion.mockResolvedValue(sesion({ twoFactorEnabled: true }));
    expect((await eliminar(json("POST", { password: "p" }))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();

    verifyTOTP.mockRejectedValueOnce(new Error("INVALID_CODE"));
    expect((await eliminar(json("POST", { password: "p", code: "000000" }))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();

    verifyTOTP.mockResolvedValueOnce({ status: true });
    expect((await eliminar(json("POST", { password: "p", code: "123456" }))).status).toBe(200);
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it("un código que no son 6 dígitos se prueba como código de recuperación", async () => {
    getSesion.mockResolvedValue(sesion({ twoFactorEnabled: true }));
    verifyBackupCode.mockResolvedValueOnce({ status: true });
    expect((await eliminar(json("POST", { password: "p", code: "abcde-12345" }))).status).toBe(200);
    expect(verifyBackupCode).toHaveBeenCalled();
    expect(verifyTOTP).not.toHaveBeenCalled();
  });

  it("contraseña incorrecta: mismo mensaje genérico, sin borrar", async () => {
    deleteUser.mockRejectedValueOnce(new Error("INVALID_PASSWORD"));
    const res = await eliminar(json("POST", { password: "mala" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("La contraseña o el código no son correctos");
  });

  it("desde otro origen: 403", async () => {
    expect((await eliminar(json("POST", { password: "p" }, { Origin: "https://malo.example" }))).status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
