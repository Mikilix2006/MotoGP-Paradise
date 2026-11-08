"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

import { applyAccent } from "@/lib/accentClient";
import { authClient } from "@/lib/authClient";
import type { UsuarioPublico } from "@/lib/session";

import { Campo, Mensaje, traducirError } from "./ui";
import { refrescarEstado } from "./useEstadoCuenta";

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-b border-white/10 pb-8 last:border-0 last:pb-0">
      <h3 className="mb-3 font-display text-xl font-black uppercase italic">{titulo}</h3>
      {children}
    </section>
  );
}

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setEnviando(true);
    try {
      const { error: err } = await authClient.changePassword({ currentPassword: actual, newPassword: nueva, revokeOtherSessions: true });
      if (err) return setError(traducirError(err));
      setActual("");
      setNueva("");
      setOk(true);
    } catch {
      setError(traducirError(null));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Bloque titulo="Cambiar contraseña">
      <form onSubmit={onSubmit} className="max-w-sm space-y-4">
        <Campo id="seg-actual" label="Contraseña actual" type="password" value={actual} onChange={setActual} autoComplete="current-password" />
        <Campo id="seg-nueva" label="Contraseña nueva" type="password" value={nueva} onChange={setNueva} autoComplete="new-password" minLength={10} maxLength={128} hint="Mínimo 10 caracteres. Se cerrará tu sesión en los demás dispositivos." />
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {ok && <Mensaje tipo="ok">Contraseña cambiada.</Mensaje>}
        <button type="submit" disabled={enviando} className="btn-race disabled:opacity-60">Cambiar contraseña</button>
      </form>
    </Bloque>
  );
}

interface Alta {
  qr: string;
  clave: string;
  codigos: string[];
}

function DosFactores({ activo }: { activo: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [alta, setAlta] = useState<Alta | null>(null);
  const [codigo, setCodigo] = useState("");
  const [codigosNuevos, setCodigosNuevos] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<void>) {
    setError(null);
    setOk(null);
    setOcupado(true);
    try {
      await fn();
    } catch {
      setError(traducirError(null));
    } finally {
      setOcupado(false);
    }
  }

  const empezar = (e: FormEvent) =>
    accion(async () => {
      e.preventDefault();
      const { data, error: err } = await authClient.twoFactor.enable({ password });
      if (err || data?.method !== "totp") return setError(traducirError(err));
      const clave = new URL(data.totpURI).searchParams.get("secret") ?? "";
      const qr = await QRCode.toDataURL(data.totpURI, { margin: 2, width: 220, color: { dark: "#000000", light: "#ffffff" } });
      setAlta({ qr, clave, codigos: data.backupCodes });
      setPassword("");
    });

  const confirmar = (e: FormEvent) =>
    accion(async () => {
      e.preventDefault();
      const { error: err } = await authClient.twoFactor.verifyTotp({ code: codigo.trim() });
      if (err) return setError(traducirError(err));
      await refrescarEstado();
      router.refresh();
      setCodigosNuevos(alta?.codigos ?? null); // siguen a la vista tras activar: es la única vez que se muestran
      setAlta(null);
      setCodigo("");
      setOk("Verificación en dos pasos activada. Guarda tus códigos de recuperación.");
    });

  const desactivar = (e: FormEvent) =>
    accion(async () => {
      e.preventDefault();
      const { error: err } = await authClient.twoFactor.disable({ password });
      if (err) return setError(traducirError(err));
      await refrescarEstado();
      router.refresh();
      setPassword("");
      setOk("Verificación en dos pasos desactivada.");
    });

  const regenerar = () =>
    accion(async () => {
      const { data, error: err } = await authClient.twoFactor.generateBackupCodes({ password });
      if (err || !data) return setError(traducirError(err));
      setCodigosNuevos(data.backupCodes);
      setPassword("");
    });

  const codigosAMostrar = alta?.codigos ?? codigosNuevos;

  return (
    <Bloque titulo="Verificación en dos pasos (2FA)">
      {!activo && !alta && (
        <form onSubmit={empezar} className="max-w-sm space-y-4">
          <p className="text-sm text-zinc-400">Además de tu contraseña, te pediremos un código de 6 dígitos de una app como Google Authenticator, Aegis o 2FAS.</p>
          <Campo id="dos-pass" label="Tu contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <button type="submit" disabled={ocupado} className="btn-race disabled:opacity-60">Activar 2FA</button>
        </form>
      )}

      {alta && (
        <form onSubmit={confirmar} className="max-w-sm space-y-4">
          <p className="text-sm text-zinc-400">1. Escanea este código con tu app de autenticación (o escribe la clave a mano).</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={alta.qr} alt="Código QR para la app de autenticación" width={220} height={220} className="rounded-lg" />
          <p className="break-all text-xs text-zinc-500">Clave: <code className="text-zinc-300">{alta.clave}</code></p>
          <p className="text-sm text-zinc-400">2. Introduce el código de 6 dígitos que te muestra la app.</p>
          <Campo id="dos-codigo" label="Código" value={codigo} onChange={setCodigo} autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <button type="submit" disabled={ocupado} className="btn-race disabled:opacity-60">Verificar y activar</button>
        </form>
      )}

      {codigosAMostrar && (
        <div className="mt-5 max-w-sm rounded-lg border border-white/15 p-4">
          <p className="text-sm font-semibold text-white">Códigos de recuperación</p>
          <p className="mt-1 text-xs text-zinc-500">Guárdalos en un sitio seguro. Cada uno sirve una sola vez si pierdes el móvil. No volverán a mostrarse.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-white">
            {codigosAMostrar.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}

      {activo && !alta && (
        <div className="max-w-sm space-y-4">
          <p className="text-sm font-semibold text-emerald-400">Activada.</p>
          <Campo id="dos-pass2" label="Tu contraseña (para cambiar algo)" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {ok && <Mensaje tipo="ok">{ok}</Mensaje>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={regenerar} disabled={ocupado || !password} className="btn-ghost disabled:opacity-50">Generar códigos nuevos</button>
            <button type="button" onClick={desactivar} disabled={ocupado || !password} className="btn-ghost disabled:opacity-50">Desactivar 2FA</button>
          </div>
        </div>
      )}
      {!activo && !alta && ok && <div className="mt-3"><Mensaje tipo="ok">{ok}</Mensaje></div>}
    </Bloque>
  );
}

function EliminarCuenta({ dosFactores }: { dosFactores: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code: dosFactores ? codigo : undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return setError(body.error ?? "No se pudo eliminar la cuenta.");
      }
      applyAccent(null);
      await refrescarEstado();
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo eliminar la cuenta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Bloque titulo="Eliminar cuenta">
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className="btn-ghost">Eliminar mi cuenta…</button>
      ) : (
        <form onSubmit={onSubmit} className="max-w-sm space-y-4">
          <p className="text-sm text-zinc-400">
            Se borrarán <strong className="text-white">ahora mismo y para siempre</strong> tu cuenta y todo lo asociado (alias, color, ajustes y, en el futuro, tus predicciones). No se puede deshacer.
          </p>
          <Campo id="del-pass" label="Tu contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {dosFactores && (
            <Campo id="del-codigo" label="Código de tu app (o de recuperación)" value={codigo} onChange={setCodigo} autoComplete="one-time-code" maxLength={32} />
          )}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={enviando} className="btn-race disabled:opacity-60">{enviando ? "Eliminando…" : "Eliminar definitivamente"}</button>
            <button type="button" onClick={() => setAbierto(false)} className="btn-ghost">Cancelar</button>
          </div>
        </form>
      )}
    </Bloque>
  );
}

export default function TabSeguridad({ usuario }: { usuario: UsuarioPublico }) {
  return (
    <div className="space-y-8">
      <CambiarContrasena />
      <DosFactores activo={usuario.dosFactores} />
      <EliminarCuenta dosFactores={usuario.dosFactores} />
    </div>
  );
}
