import { CONTACT_EMAIL, TITULAR } from "@/lib/site";

// Estilo común de las páginas de texto legal (aviso legal, privacidad, condiciones).
export const ARTICULO_LEGAL =
  "mx-auto max-w-3xl px-5 py-10 md:py-16 [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-white/10 [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_p]:mt-3 [&_p]:max-w-[65ch] [&_p]:text-base [&_p]:leading-7 [&_p]:text-zinc-400 [&_ul]:mt-3 [&_ul]:max-w-[65ch] [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-base [&_ul]:leading-7 [&_ul]:text-zinc-400 [&>p:first-of-type]:mt-5 [&>p:first-of-type]:text-sm [&>p:first-of-type]:text-zinc-500";

export const ENLACE_LEGAL = "font-semibold text-white underline decoration-red-500 underline-offset-4 hover:text-red-500";

export function Correo() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={ENLACE_LEGAL}>
      {CONTACT_EMAIL}
    </a>
  );
}

/** Con las cuentas abiertas el titular es obligatorio en producción; en desarrollo se muestra un marcador. */
export function titular(): string {
  if (TITULAR) return TITULAR;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta el nombre del titular: rellena TITULAR en src/lib/site.ts antes de abrir el registro.");
  }
  return "[titular pendiente]";
}
