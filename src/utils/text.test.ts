import { describe, expect, it } from "vitest";

import { htmlToPlainText } from "./text";
import { textosRaros as t } from "./__fixtures__/textosRaros";

describe("htmlToPlainText (PIL-07)", () => {
  it("corrige la doble codificación UTF-8", () => {
    expect(htmlToPlainText(t.dobleCodificacion)).toBe("Nacido en España, Márquez gana.");
  });

  it("no reconvierte si el texto no cabe en Latin-1", () => {
    expect(htmlToPlainText(t.mezclaNoLatin1)).toBe(t.mezclaNoLatin1);
  });

  it("decodifica entidades nombradas y numéricas", () => {
    expect(htmlToPlainText(t.entidades)).toBe('Tom & Jerry "campeones" ñ ñ <b> fin');
  });

  it("decodifica las entidades una sola vez", () => {
    expect(htmlToPlainText(t.dobleEntidad)).toBe("&lt;");
  });

  it("deja las entidades desconocidas y descarta las numéricas inválidas", () => {
    expect(htmlToPlainText("a &foo; b &#0; c &#xD800; d")).toBe("a &foo; b c d");
  });

  it("quita script y style con su contenido", () => {
    expect(htmlToPlainText(t.conScript)).toBe("Hola mundo!");
  });

  it("párrafos separados por línea en blanco y <br> por salto simple", () => {
    expect(htmlToPlainText(t.parrafos)).toBe("Uno\n\nDos");
    expect(htmlToPlainText(t.saltos)).toBe("Línea 1\nLínea 2\nLínea 3");
  });

  it("cierres de bloque (h, div, li) separan párrafos sin acumular saltos", () => {
    expect(htmlToPlainText(t.bloques)).toBe("Título\n\nTexto\n\na\n\nb");
  });

  it("sin texto devuelve null", () => {
    expect(htmlToPlainText(null)).toBeNull();
    expect(htmlToPlainText(undefined)).toBeNull();
    expect(htmlToPlainText("")).toBeNull();
    expect(htmlToPlainText(t.soloEtiquetas)).toBeNull();
  });
});
