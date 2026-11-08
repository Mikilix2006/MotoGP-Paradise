"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { authClient } from "@/lib/authClient";

import { Campo, Mensaje, Panel, traducirError } from "./ui";

/** Sin `token`: pide el enlace por correo. Con `token` (llega en el enlace del correo): elige la contraseña nueva. */
export default function FormRecuperar({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { error: err } = token
        ? await authClient.resetPassword({ newPassword: password, token })
        : await authClient.requestPasswordReset({ email, redirectTo: "/recuperar" });
      if (err) setError(traducirError(err));
      else setHecho(true);
    } catch {
      setError(traducirError(null));
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <Panel titulo={token ? "Contraseña cambiada" : "Revisa tu correo"}>
        <p className="text-sm text-zinc-400">
          {token
            ? "Ya puedes iniciar sesión con tu contraseña nueva. Se han cerrado las sesiones abiertas en otros dispositivos."
            : "Si existe una cuenta con ese correo, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en una hora."}
        </p>
        <Link href="/acceso" className="btn-ghost mt-5 w-full">Ir a iniciar sesión</Link>
      </Panel>
    );
  }

  return (
    <Panel titulo={token ? "Elige una contraseña nueva" : "Recuperar contraseña"}>
      <form onSubmit={onSubmit} className="space-y-4">
        {token ? (
          <Campo id="rec-pass" label="Contraseña nueva" type="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={10} maxLength={128} hint="Mínimo 10 caracteres." />
        ) : (
          <Campo id="rec-email" label="Correo de tu cuenta" type="email" value={email} onChange={setEmail} autoComplete="email" />
        )}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <button type="submit" disabled={enviando} className="btn-race w-full disabled:opacity-60">
          {enviando ? "Enviando…" : token ? "Cambiar contraseña" : "Enviar enlace"}
        </button>
      </form>
      <p className="mt-5 text-sm text-zinc-400">
        <Link href="/acceso" className="underline hover:text-white">Volver a iniciar sesión</Link>
      </p>
    </Panel>
  );
}
