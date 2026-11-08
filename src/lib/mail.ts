import nodemailer from "nodemailer";

import { SITE_NAME } from "./site";

interface Correo {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envía un correo por SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
 * Sin SMTP_HOST: en desarrollo lo imprime por consola; en producción falla (no se pierde en silencio).
 */
export async function enviarCorreo({ to, subject, text }: Correo): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST no está definido: no se pueden enviar correos de cuenta");
    }
    console.info(`\n[correo de desarrollo]\nPara: ${to}\nAsunto: ${subject}\n\n${text}\n`);
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? `${SITE_NAME} <${user ?? "no-responder@localhost"}>`, to, subject, text });
}
