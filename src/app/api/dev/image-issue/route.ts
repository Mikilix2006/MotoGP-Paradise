import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/*
 * Solo desarrollo: registra en logs/imagenes-pilotos.log las imágenes de piloto
 * que el carrusel no ha podido mostrar. En producción responde 404 y no escribe.
 */

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "imagenes-pilotos.log");

const MAX_BODY = 4000;

const REASONS: Record<string, string> = {
  null: "null: no hay URL válida en la base de datos",
  error: "error de carga: la URL existe pero no se pudo cargar",
};

// Combinaciones piloto+motivo+URL ya registradas desde que arrancó el servidor.
const logged = new Set<string>();

// Una sola línea por registro: se eliminan saltos de línea y otros caracteres de control.
const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ");

function field(value: unknown, max: number, required = true): string | null {
  if (value === null || value === undefined || value === "") {
    return required ? null : "";
  }

  return typeof value === "string" && value.length <= max ? value : null;
}

const notFound = () =>
  NextResponse.json({ error: "No encontrado" }, { status: 404 });

const badRequest = () =>
  NextResponse.json({ error: "Cuerpo de la petición no válido" }, { status: 400 });

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return notFound();
  }

  // Exigir JSON obliga a una petición de otro origen a pasar por CORS (preflight).
  // Tipo exacto: "text/plain; application/json" no dispara preflight.
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.split(";")[0].trim() !== "application/json") {
    return badRequest();
  }

  let body: Record<string, unknown>;

  try {
    const text = await request.text();

    if (text.length > MAX_BODY) {
      return badRequest();
    }

    body = JSON.parse(text);
  } catch {
    return badRequest();
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest();
  }

  const riderId = field(body.rider_id, 100);
  const fullName = field(body.full_name, 200);
  const imageUrl = field(body.image_url, 2000, false);
  const reason = typeof body.reason === "string" ? body.reason : "";

  if (
    !riderId ||
    !fullName ||
    imageUrl === null ||
    !Object.hasOwn(REASONS, reason)
  ) {
    return badRequest();
  }

  const key = `${riderId}|${reason}|${imageUrl}`;

  if (logged.has(key)) {
    return NextResponse.json({ data: { logged: false } });
  }

  const line = oneLine(
    `${new Date().toISOString()} | ${fullName} (${riderId}) | ${REASONS[reason]} | ${imageUrl || "sin URL"}`
  );

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${line}\n`, "utf8");
  } catch (error) {
    console.error("Error escribiendo el registro de imágenes:", error);

    return NextResponse.json(
      { error: "No se pudo escribir el registro de imágenes" },
      { status: 500 }
    );
  }

  logged.add(key);

  return NextResponse.json({ data: { logged: true } });
}
