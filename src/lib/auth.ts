import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor, username } from "better-auth/plugins";

import { enviarCorreo } from "./mail";
import { prisma } from "./prisma";
import { SITE_NAME } from "./site";

const DIA = 60 * 60 * 24;

// Los correos no se esperan (await): así el tiempo de respuesta no delata si un email existe.
function enviar(to: string, subject: string, text: string) {
  enviarCorreo({ to, subject, text }).catch((err) => console.error("No se pudo enviar el correo de cuenta:", err));
}

function crearAuth() {
  return betterAuth({
    appName: SITE_NAME,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    // El borrado de cuenta solo se hace por /api/cuenta/eliminar, que exige también el código 2FA.
    // `disabledPaths` cierra la ruta HTTP; `auth.api.deleteUser` sigue disponible en el servidor.
    disabledPaths: ["/delete-user"],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        enviar(
          user.email,
          `Restablece tu contraseña de ${SITE_NAME}`,
          `Hola ${user.name}:\n\nPulsa aquí para elegir una contraseña nueva (el enlace caduca en una hora):\n${url}\n\nSi no lo has pedido tú, ignora este mensaje: tu contraseña no cambia.`,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        enviar(
          user.email,
          `Confirma tu correo en ${SITE_NAME}`,
          `Hola ${user.name}:\n\nPulsa aquí para confirmar tu correo y activar tu cuenta:\n${url}\n\nSi no te has registrado tú, ignora este mensaje.`,
        );
      },
    },
    // `Session` ya existe en el esquema (sesiones de carrera): las tablas de cuentas llevan prefijo Auth.
    account: { modelName: "authAccount" },
    verification: { modelName: "authVerification" },
    user: {
      modelName: "authUser",
      additionalFields: {
        // Color de acento elegido (#rrggbb). Solo se escribe desde /api/cuenta/color, que lo valida.
        accentColor: { type: "string", required: false, input: false },
      },
      deleteUser: { enabled: true },
    },
    session: { modelName: "authSession", expiresIn: 30 * DIA, updateAge: DIA, freshAge: 10 * 60 },
    // La IP solo vive en memoria para limitar intentos: no se guarda en la base de datos (aviso legal).
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 10,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/request-password-reset": { window: 3600, max: 3 },
        "/send-verification-email": { window: 3600, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },
    databaseHooks: {
      session: {
        create: { before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }) },
      },
    },
    plugins: [username(), twoFactor({ issuer: SITE_NAME, twoFactorTable: "authTwoFactor" }), nextCookies()],
  });
}

// Se crea al primer uso (no al importar) para que `next build` no exija el secreto de producción.
let instancia: ReturnType<typeof crearAuth> | undefined;
export function getAuth() {
  return (instancia ??= crearAuth());
}
