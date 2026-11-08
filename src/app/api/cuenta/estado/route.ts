import { NextResponse } from "next/server";

import { registroAbierto } from "@/lib/registro";
import { getSesion, usuarioPublico } from "@/lib/session";

export const dynamic = "force-dynamic";

/* Lo usa el botón de perfil del header: ¿hay cuentas? ¿hay sesión? Nunca da error: sin sesión, usuario null. */
export async function GET() {
  if (!registroAbierto()) return NextResponse.json({ data: { abierto: false, usuario: null } });
  try {
    const sesion = await getSesion();
    return NextResponse.json({ data: { abierto: true, usuario: sesion ? usuarioPublico(sesion.user) : null } });
  } catch (error) {
    console.error("Error leyendo la sesión:", error);
    return NextResponse.json({ data: { abierto: true, usuario: null } });
  }
}
