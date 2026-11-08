import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";
import { registroAbierto } from "@/lib/registro";

export const dynamic = "force-dynamic";

// Con el registro cerrado la API de cuentas no existe (404), como las páginas.
const cerrado = () => new Response("Not Found", { status: 404 });

export async function GET(request: Request) {
  return registroAbierto() ? toNextJsHandler(getAuth()).GET(request) : cerrado();
}

export async function POST(request: Request) {
  return registroAbierto() ? toNextJsHandler(getAuth()).POST(request) : cerrado();
}
