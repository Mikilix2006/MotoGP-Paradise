"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/authClient";

import { Campo, Mensaje, Panel, traducirError } from "./ui";
import { refrescarEstado } from "./useEstadoCuenta";

type Paso = "datos" | "codigo";

export default function FormAcceso({ verificado = false }: { verificado?: boolean }) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("datos");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [recuperacion, setRecuperacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinVerificar, setSinVerificar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    await refrescarEstado();
    router.push("/perfil");
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      if (paso === "datos") {
        const { data, error: err } = await authClient.signIn.email({ email, password });
        if (err) {
          setSinVerificar(err.code === "EMAIL_NOT_VERIFIED");
          setError(traducirError(err));
        } else if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
          setPaso("codigo");
        } else {
          await entrar();
        }
      } else {
        const limpio = codigo.trim();
        const { error: err } = recuperacion
          ? await authClient.twoFactor.verifyBackupCode({ code: limpio })
          : await authClient.twoFactor.verifyTotp({ code: limpio });
        if (err) setError(traducirError(err));
        else await entrar();
      }
    } catch {
      setError(traducirError(null));
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setError(null);
    const { error: err } = await authClient.sendVerificationEmail({ email, callbackURL: "/acceso?verificado=1" });
    if (err) setError(traducirError(err));
    else setAviso("Te hemos enviado un correo nuevo. Revisa tu bandeja de entrada.");
  }

  return (
    <Panel titulo="Iniciar sesión">
      {verificado && paso === "datos" && <div className="mb-4"><Mensaje tipo="ok">Correo confirmado. Ya puedes iniciar sesión.</Mensaje></div>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        {paso === "datos" ? (
          <>
            <Campo id="acc-email" label="Correo" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Campo id="acc-pass" label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400">
              {recuperacion ? "Introduce uno de tus códigos de recuperación." : "Introduce el código de 6 dígitos de tu app de autenticación."}
            </p>
            <Campo
              id="acc-codigo"
              label={recuperacion ? "Código de recuperación" : "Código"}
              value={codigo}
              onChange={setCodigo}
              autoComplete="one-time-code"
              inputMode={recuperacion ? "text" : "numeric"}
              maxLength={recuperacion ? 32 : 6}
            />
            <button type="button" onClick={() => { setRecuperacion((v) => !v); setCodigo(""); setError(null); }} className="text-xs font-bold uppercase tracking-wider text-zinc-400 underline hover:text-white">
              {recuperacion ? "Usar la app de autenticación" : "He perdido mi móvil: usar un código de recuperación"}
            </button>
          </>
        )}

        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {aviso && <Mensaje tipo="ok">{aviso}</Mensaje>}
        {sinVerificar && (
          <button type="button" onClick={reenviar} className="btn-ghost w-full">
            Reenviar el correo de confirmación
          </button>
        )}

        <button type="submit" disabled={enviando} className="btn-race w-full disabled:opacity-60">
          {enviando ? "Comprobando…" : paso === "datos" ? "Entrar" : "Verificar"}
        </button>
      </form>

      {paso === "datos" && (
        <p className="mt-5 space-y-1 text-sm text-zinc-400">
          <Link href="/recuperar" className="block underline hover:text-white">He olvidado mi contraseña</Link>
          <Link href="/registro" className="block underline hover:text-white">Crear una cuenta</Link>
        </p>
      )}
    </Panel>
  );
}
