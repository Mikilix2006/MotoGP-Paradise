import { NextResponse } from "next/server";

import { deriveAccent, parseHex, toHex } from "@/lib/accent";
import { prisma } from "@/lib/prisma";
import { registroAbierto } from "@/lib/registro";
import { getSesion, origenValido } from "@/lib/session";

export const dynamic = "force-dynamic";

/*
 * PUT {color: "#rrggbb"} guarda el acento del usuario; DELETE vuelve al rojo por defecto.
 * El color se valida aquí (el campo no es editable desde la API de Better Auth). Se guarda el
 * elegido, no el ajustado: el ajuste de luminosidad se calcula al leerlo (src/lib/accent.ts).
 */
async function guardar(request: Request, color: string | null) {
  if (!registroAbierto()) return new NextResponse("Not Found", { status: 404 });
  if (!origenValido(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const sesion = await getSesion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión para cambiar el color" }, { status: 401 });

  try {
    await prisma.authUser.update({ where: { id: sesion.user.id }, data: { accentColor: color } });
    return NextResponse.json({ data: { color, tokens: color ? deriveAccent(color) : null } });
  } catch (error) {
    console.error("Error guardando el color:", error);
    return NextResponse.json({ error: "No se pudo guardar el color" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { color?: unknown } | null;
  const rgb = typeof body?.color === "string" ? parseHex(body.color) : null;
  if (!rgb) return NextResponse.json({ error: "El color debe ser un valor #rrggbb" }, { status: 400 });
  return guardar(request, toHex(rgb));
}

export async function DELETE(request: Request) {
  return guardar(request, null);
}
