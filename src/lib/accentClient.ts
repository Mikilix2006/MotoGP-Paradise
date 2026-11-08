import { ACCENT_COOKIE, ACCENT_STYLE_ID, accentCookieValue, accentCss, type AccentTokens } from "./accent";

/** Aplica el acento al momento y lo recuerda en la cookie funcional. `null` = volver al rojo por defecto. */
export function applyAccent(tokens: AccentTokens | null): void {
  document.getElementById(ACCENT_STYLE_ID)?.remove();
  if (tokens) {
    const style = document.createElement("style");
    style.id = ACCENT_STYLE_ID;
    style.textContent = accentCss(tokens);
    document.head.appendChild(style);
  }
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = tokens
    ? `${ACCENT_COOKIE}=${accentCookieValue(tokens)}; path=/; max-age=31536000; samesite=lax${secure}`
    : `${ACCENT_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}
