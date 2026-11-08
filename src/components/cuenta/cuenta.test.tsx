// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const signIn = vi.fn();
const signUp = vi.fn();
const verifyTotp = vi.fn();
vi.mock("@/lib/authClient", () => ({
  authClient: {
    signIn: { email: (...a: unknown[]) => signIn(...a) },
    signUp: { email: (...a: unknown[]) => signUp(...a) },
    twoFactor: { verifyTotp: (...a: unknown[]) => verifyTotp(...a), verifyBackupCode: vi.fn() },
    sendVerificationEmail: vi.fn(),
    signOut: vi.fn(),
  },
}));

import FormAcceso from "./FormAcceso";
import FormRegistro from "./FormRegistro";
import PerfilTabs from "./PerfilTabs";
import { traducirError } from "./ui";
import type { UsuarioPublico } from "@/lib/session";

const usuario: UsuarioPublico = { alias: "Ana", email: "ana@x.es", color: null, tokens: null, dosFactores: false };

// El estado de cuenta se cachea por módulo: cada test que lo necesita parte de un módulo limpio.
async function cargarBoton(estado: { abierto: boolean; usuario: UsuarioPublico | null }) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: estado }))));
  return (await import("./PerfilBoton")).default;
}

beforeEach(() => {
  signIn.mockReset();
  signUp.mockReset();
  verifyTotp.mockReset();
  push.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("traducirError", () => {
  it("traduce códigos conocidos, el límite de intentos y lo desconocido", () => {
    expect(traducirError({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("El correo o la contraseña no son correctos.");
    expect(traducirError({ code: "USERNAME_IS_ALREADY_TAKEN" })).toContain("alias");
    expect(traducirError({ status: 429, code: "OTRA" })).toContain("Demasiados intentos");
    expect(traducirError({ code: "ALGO_RARO" })).toBe("Algo ha ido mal. Inténtalo de nuevo.");
    expect(traducirError(null)).toBe("Algo ha ido mal. Inténtalo de nuevo.");
  });
});

describe("FormRegistro", () => {
  async function rellenar(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Correo"), "ana@x.es");
    await user.type(screen.getByLabelText("Alias"), "ana_f1");
    await user.type(screen.getByLabelText("Contraseña"), "una frase muy larga");
  }

  it("sin aceptar las condiciones no llama a la API", async () => {
    const user = userEvent.setup();
    render(<FormRegistro />);
    await rellenar(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(screen.getByRole("alert")).toHaveTextContent("aceptar las condiciones");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("registra con el alias como usuario y nombre, y pide revisar el correo", async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<FormRegistro />);
    await rellenar(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(signUp).toHaveBeenCalledWith({
      email: "ana@x.es",
      password: "una frase muy larga",
      name: "ana_f1",
      username: "ana_f1",
      callbackURL: "/acceso?verificado=1",
    });
    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument();
  });

  it("muestra el error traducido (alias ocupado)", async () => {
    signUp.mockResolvedValue({ data: null, error: { code: "USERNAME_IS_ALREADY_TAKEN", status: 422 } });
    const user = userEvent.setup();
    render(<FormRegistro />);
    await rellenar(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("alias ya está en uso");
  });
});

describe("FormAcceso", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { abierto: true, usuario: null } }))));
  });

  it("credenciales malas: error y botón para reenviar solo si falta verificar el correo", async () => {
    signIn.mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    const user = userEvent.setup();
    render(<FormAcceso />);
    await user.type(screen.getByLabelText("Correo"), "ana@x.es");
    await user.type(screen.getByLabelText("Contraseña"), "xxxxxxxxxxxx");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("confirmado tu correo");
    expect(screen.getByRole("button", { name: /Reenviar/ })).toBeInTheDocument();
  });

  it("con 2FA pide el código y, al verificarlo, entra al perfil", async () => {
    signIn.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    verifyTotp.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<FormAcceso />);
    await user.type(screen.getByLabelText("Correo"), "ana@x.es");
    await user.type(screen.getByLabelText("Contraseña"), "xxxxxxxxxxxx");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await user.type(await screen.findByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/perfil"));
  });

  it("sin 2FA entra directamente", async () => {
    signIn.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(<FormAcceso />);
    await user.type(screen.getByLabelText("Correo"), "ana@x.es");
    await user.type(screen.getByLabelText("Contraseña"), "xxxxxxxxxxxx");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/perfil"));
    expect(verifyTotp).not.toHaveBeenCalled();
  });
});

describe("PerfilBoton (header)", () => {
  it("cuentas cerradas: marcador «próximamente» deshabilitado, sin enlace", async () => {
    const Boton = await cargarBoton({ abierto: false, usuario: null });
    render(<Boton />);
    const marcador = await screen.findByRole("button", { name: "Perfil (próximamente)" });
    expect(marcador).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("cuentas abiertas sin sesión: enlace a /acceso", async () => {
    const Boton = await cargarBoton({ abierto: true, usuario: null });
    render(<Boton />);
    expect(await screen.findByRole("link", { name: "Acceder o crear cuenta" })).toHaveAttribute("href", "/acceso");
  });

  it("con sesión: enlace a /perfil con el alias", async () => {
    const Boton = await cargarBoton({ abierto: true, usuario });
    render(<Boton />);
    const enlace = await screen.findByRole("link", { name: "Mi perfil, Ana" });
    expect(enlace).toHaveAttribute("href", "/perfil");
    expect(enlace).toHaveTextContent("Ana");
  });

  it("si la consulta falla, queda el marcador (no rompe el header)", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));
    const Boton = (await import("./PerfilBoton")).default;
    render(<Boton />);
    expect(await screen.findByRole("button", { name: "Perfil (próximamente)" })).toBeInTheDocument();
  });
});

describe("PerfilTabs", () => {
  it("muestra las 5 pestañas, Cuenta primero, y las futuras como «Próximamente»", async () => {
    const user = userEvent.setup();
    render(<PerfilTabs usuario={usuario} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Cuenta", "Apariencia", "Seguridad", "Predicciones", "Notificaciones"]);
    expect(screen.getByRole("tab", { name: "Cuenta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("ana@x.es")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Predicciones" }));
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Notificaciones" }));
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
  });

  it("las flechas del teclado recorren las pestañas (con vuelta al principio)", async () => {
    const user = userEvent.setup();
    render(<PerfilTabs usuario={usuario} />);
    screen.getByRole("tab", { name: "Cuenta" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Apariencia" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Notificaciones" })).toHaveAttribute("aria-selected", "true");
  });

  it("Seguridad pide el código solo si la cuenta tiene 2FA al eliminar", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PerfilTabs usuario={usuario} />);
    await user.click(screen.getByRole("tab", { name: "Seguridad" }));
    await user.click(screen.getByRole("button", { name: /Eliminar mi cuenta/ }));
    expect(screen.queryByLabelText(/Código de tu app/)).toBeNull();

    rerender(<PerfilTabs usuario={{ ...usuario, dosFactores: true }} />);
    expect(screen.getByLabelText(/Código de tu app/)).toBeInTheDocument();
  });
});
