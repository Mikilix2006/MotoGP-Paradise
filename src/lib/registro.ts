// Interruptor de las cuentas de usuario. Apagado por defecto: se enciende en el servidor con
// REGISTRO_ABIERTO=true cuando estén listos el SMTP y el nombre del titular (ver AGENTS.md, «Antes de abrir el registro de cuentas»).
// Se lee en cada petición (nunca al construir), por eso las páginas que lo usan son dinámicas.
export function registroAbierto(): boolean {
  return process.env.REGISTRO_ABIERTO === "true";
}
