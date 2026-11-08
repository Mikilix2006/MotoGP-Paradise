"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_ACCENT_HEX, deriveAccent, toHex, type AccentTokens } from "@/lib/accent";
import { applyAccent } from "@/lib/accentClient";
import type { UsuarioPublico } from "@/lib/session";

import { FOCUS_RING, INPUT_CLASS, LABEL_CLASS, Mensaje } from "./ui";
import { refrescarEstado } from "./useEstadoCuenta";

export default function TabApariencia({ usuario }: { usuario: UsuarioPublico }) {
  const router = useRouter();
  const [color, setColor] = useState(usuario.color ?? DEFAULT_ACCENT_HEX);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const tokens = deriveAccent(color);
  const ajustado = tokens !== null && toHex(tokens.light).toLowerCase() !== color.toLowerCase();

  async function enviar(metodo: "PUT" | "DELETE", valor: string | null) {
    setError(null);
    setOk(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/cuenta/color", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: metodo === "PUT" ? JSON.stringify({ color: valor }) : undefined,
      });
      const body = (await res.json()) as { data?: { color: string | null; tokens: AccentTokens | null }; error?: string };
      if (!res.ok || !body.data) return setError(body.error ?? "No se pudo guardar el color.");
      applyAccent(body.data.tokens);
      await refrescarEstado();
      router.refresh();
      if (metodo === "DELETE") setColor(DEFAULT_ACCENT_HEX);
      setOk(metodo === "DELETE" ? "Has vuelto al rojo de siempre." : "Color guardado.");
    } catch {
      setError("No se pudo guardar el color.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-400">
        Elige el color principal de Rebufo (el rojo de botones, barras y detalles). Se guarda en tu cuenta y lo verás en cualquier dispositivo donde inicies sesión.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="ap-color" className={LABEL_CLASS}>Color</label>
          <input
            id="ap-color"
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_ACCENT_HEX}
            onChange={(e) => setColor(e.target.value)}
            className={`h-11 w-20 cursor-pointer rounded-lg border border-white/15 bg-[var(--surface)] p-1 ${FOCUS_RING}`}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="ap-hex" className={LABEL_CLASS}>Código</label>
          <input id="ap-hex" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} spellCheck={false} className={`${INPUT_CLASS} w-32 uppercase`} />
        </div>
      </div>

      {tokens ? (
        <div className="flex flex-wrap items-center gap-3" aria-label="Vista previa">
          <span className="cut inline-flex min-h-9 items-center px-5 text-sm font-black uppercase tracking-wider text-[#fff]" style={{ background: `linear-gradient(135deg, rgb(${tokens.light.join(" ")}), rgb(${tokens.light.join(" ")}))` }}>
            Vista previa
          </span>
          {ajustado && (
            <p className="text-xs text-zinc-500">Hemos ajustado un poco la luminosidad para que el texto se lea bien en tema claro y oscuro.</p>
          )}
        </div>
      ) : (
        <Mensaje tipo="error">Escribe un color con el formato #rrggbb.</Mensaje>
      )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {ok && <Mensaje tipo="ok">{ok}</Mensaje>}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!tokens || guardando} onClick={() => enviar("PUT", color)} className="btn-race disabled:opacity-60">
          Guardar color
        </button>
        <button type="button" disabled={guardando || usuario.color === null} onClick={() => enviar("DELETE", null)} className="btn-ghost disabled:opacity-50">
          Volver al rojo
        </button>
      </div>
    </div>
  );
}
