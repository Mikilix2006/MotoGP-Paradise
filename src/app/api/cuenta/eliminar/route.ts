import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";
import { registroAbierto } from "@/lib/registro";
import { getSesion, origenValido } from "@/lib/session";

export const dynamic = "force-dynamic";

/*
 * POST {password, code?}: borra la cuenta y todos sus datos al instante.
 * Exige la contraseña y, si la cuenta tiene 2FA, un código TOTP o de recuperación.
 * La ruta /api/auth/delete-user está cerrada (src/lib/auth.ts) para que no se pueda saltar el 2FA.
 */
export async function POST(request: Request) {
  if (!registroAbierto()) return new NextResponse("Not Found", { status: 404 });
  if (!origenValido(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const sesion = await getSesion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión para eliminar tu cuenta" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { password?: unknown; code?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!password) return NextResponse.json({ error: "Introduce tu contraseña" }, { status: 400 });

  const auth = getAuth();
  const cabeceras = await headers();
  try {
    if (sesion.user.twoFactorEnabled) {
      if (!code) return NextResponse.json({ error: "Introduce el código de tu app de autenticación" }, { status: 400 });
      // Un código TOTP son 6 dígitos; cualquier otra cosa se prueba como código de recuperación.
      if (/^\d{6}$/.test(code)) await auth.api.verifyTOTP({ headers: cabeceras, body: { code } });
      else await auth.api.verifyBackupCode({ headers: cabeceras, body: { code } });
    }
    await auth.api.deleteUser({ headers: cabeceras, body: { password } });
    return NextResponse.json({ data: { eliminada: true } });
  } catch {
    // Mensaje único: no se distingue contraseña mala de código malo.
    return NextResponse.json({ error: "La contraseña o el código no son correctos" }, { status: 400 });
  }
}
