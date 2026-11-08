import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport: (...a: unknown[]) => createTransport(...(a as [])) } }));

import { enviarCorreo } from "./mail";

const correo = { to: "ana@x.es", subject: "Asunto", text: "Cuerpo" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("enviarCorreo", () => {
  it("sin SMTP en desarrollo: lo imprime por consola y no envía", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await enviarCorreo(correo);
    expect(info.mock.calls[0][0]).toContain("ana@x.es");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("sin SMTP en producción: falla en voz alta (no se pierde el correo en silencio)", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(enviarCorreo(correo)).rejects.toThrow(/SMTP_HOST/);
  });

  it("con SMTP: usa el servidor, el puerto y el remitente configurados", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.ejemplo.es");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "u");
    vi.stubEnv("SMTP_PASS", "p");
    vi.stubEnv("SMTP_FROM", "Rebufo <hola@ejemplo.es>");
    await enviarCorreo(correo);
    expect(createTransport).toHaveBeenCalledWith({ host: "smtp.ejemplo.es", port: 465, secure: true, auth: { user: "u", pass: "p" } });
    expect(sendMail).toHaveBeenCalledWith({ from: "Rebufo <hola@ejemplo.es>", ...correo });
  });
});
