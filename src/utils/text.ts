const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/*
 * Corrige la doble codificación UTF-8 ("Ã±" en vez de "ñ"): solo si todo el
 * texto cabe en Latin-1 y la reconversión no produce caracteres inválidos.
 */
function fixDoubleEncoding(text: string): string {
  if (!/[ÃÂ][\u0080-¿]/.test(text) || /[^\u0000-ÿ]/.test(text)) {
    return text;
  }

  const fixed = Buffer.from(text, "latin1").toString("utf8");

  return fixed.includes("�") ? text : fixed;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] !== "#") {
      // shortcut: solo las entidades nombradas habituales; el resto se deja tal cual.
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    }

    const code =
      body[1].toLowerCase() === "x"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);

    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : "";
  });
}

/**
 * Convierte el HTML de una biografía de la API en texto plano seguro:
 * sin etiquetas (ni el contenido de script/style), con las entidades
 * decodificadas una sola vez y los párrafos separados por "\n\n".
 * Devuelve null si no queda texto. Nunca se debe renderizar el HTML original.
 */
export function htmlToPlainText(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }

  const text = decodeEntities(
    fixDoubleEncoding(html)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}
