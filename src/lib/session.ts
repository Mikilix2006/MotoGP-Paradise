import { headers } from "next/headers";

import { deriveAccent, type AccentTokens } from "./accent";
import { getAuth } from "./auth";

/** Sesión de la petición actual (o `null`). Solo se llama con el registro abierto. */
export async function getSesion() {
  return getAuth().api.getSession({ headers: await headers() });
}

type UsuarioSesion = NonNullable<Awaited<ReturnType<typeof getSesion>>>["user"];

export interface UsuarioPublico {
  alias: string;
  email: string;
  color: string | null;
  tokens: AccentTokens | null;
  dosFactores: boolean;
}

export function usuarioPublico(user: UsuarioSesion): UsuarioPublico {
  const color = typeof user.accentColor === "string" ? user.accentColor : null;
  return {
    alias: user.displayUsername || user.username || user.name,
    email: user.email,
    color,
    tokens: color ? deriveAccent(color) : null,
    dosFactores: Boolean(user.twoFactorEnabled),
  };
}

/** Defensa en profundidad para las rutas que cambian datos: si hay Origin, debe ser el de la propia web. */
export function origenValido(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return origin === new URL(base).origin || origin === new URL(request.url).origin;
}
