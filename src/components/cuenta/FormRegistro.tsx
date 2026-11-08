"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { authClient } from "@/lib/authClient";

import { Campo, FOCUS_RING, Mensaje, Panel, traducirError } from "./ui";

export default function FormRegistro() {
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acepto) return setError("Para crear la cuenta tienes que aceptar las condiciones.");
    setEnviando(true);
    try {
      const { error: err } = await authClient.signUp.email({
        email,
        password,
        name: alias,
        username: alias,
        callbackURL: "/acceso?verificado=1",
      });
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
      <Panel titulo="Revisa tu correo">
        <p className="text-sm text-zinc-400">
          Te hemos enviado un enlace a <strong className="text-white">{email}</strong> para confirmar tu cuenta. Hasta que lo pulses no podrás iniciar sesión.
        </p>
        <p className="mt-4 text-sm text-zinc-400">Si no llega en unos minutos, mira en spam.</p>
        <Link href="/acceso" className="btn-ghost mt-5 w-full">Ir a iniciar sesión</Link>
      </Panel>
    );
  }

  return (
    <Panel titulo="Crear cuenta">
      <form onSubmit={onSubmit} className="space-y-4">
        <Campo id="reg-email" label="Correo" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Campo
          id="reg-alias"
          label="Alias"
          value={alias}
          onChange={setAlias}
          autoComplete="username"
          minLength={3}
          maxLength={30}
          hint="Entre 3 y 30 caracteres: letras, números, puntos y guiones bajos. Será tu nombre público (por ejemplo, en los rankings de Predicciones)."
        />
        <Campo
          id="reg-pass"
          label="Contraseña"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          hint="Mínimo 10 caracteres. Mejor una frase larga que algo complicado."
        />
        <label className="flex items-start gap-3 text-sm text-zinc-400">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className={`mt-1 h-4 w-4 shrink-0 accent-red-600 ${FOCUS_RING}`} />
          <span>
            Tengo 14 años o más y acepto las{" "}
            <Link href="/condiciones" className="underline hover:text-white">condiciones de uso</Link> y la{" "}
            <Link href="/privacidad" className="underline hover:text-white">política de privacidad</Link>.
          </span>
        </label>

        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <button type="submit" disabled={enviando} className="btn-race w-full disabled:opacity-60">
          {enviando ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-5 text-sm text-zinc-400">
        ¿Ya tienes cuenta? <Link href="/acceso" className="underline hover:text-white">Inicia sesión</Link>
      </p>
    </Panel>
  );
}
