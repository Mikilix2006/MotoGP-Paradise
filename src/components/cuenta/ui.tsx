"use client";

import type { ReactNode } from "react";

export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";
export const INPUT_CLASS = `min-h-11 w-full rounded-lg border border-white/15 bg-[var(--surface)] px-3 text-sm font-semibold text-white placeholder:text-zinc-500 disabled:opacity-50 ${FOCUS_RING}`;
export const LABEL_CLASS = "mb-1 block text-[11px] font-bold uppercase tracking-widest text-zinc-500";

interface ErrorAuth {
  code?: string;
  status?: number;
  message?: string;
}

// Mensajes en español para los códigos de error de Better Auth (vienen en inglés).
const MENSAJES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "El correo o la contraseña no son correctos.",
  INVALID_USERNAME_OR_PASSWORD: "El correo o la contraseña no son correctos.",
  EMAIL_NOT_VERIFIED: "Aún no has confirmado tu correo. Revisa tu bandeja de entrada.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  USERNAME_IS_ALREADY_TAKEN: "Ese alias ya está en uso. Elige otro.",
  INVALID_USERNAME: "El alias solo admite letras, números, puntos y guiones bajos.",
  USERNAME_TOO_SHORT: "El alias debe tener entre 3 y 30 caracteres.",
  USERNAME_TOO_LONG: "El alias debe tener entre 3 y 30 caracteres.",
  INVALID_EMAIL: "El correo no es válido.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 10 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña puede tener 128 caracteres como máximo.",
  INVALID_PASSWORD: "La contraseña no es correcta.",
  INVALID_TOKEN: "El enlace no es válido o ha caducado. Pide uno nuevo.",
  TOKEN_EXPIRED: "El enlace no es válido o ha caducado. Pide uno nuevo.",
  INVALID_CODE: "El código no es correcto.",
  INVALID_BACKUP_CODE: "El código de recuperación no es correcto.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Demasiados intentos. Vuelve a iniciar sesión.",
  ACCOUNT_TEMPORARILY_LOCKED: "Demasiados intentos fallidos. Espera unos minutos y vuelve a probar.",
  INVALID_TWO_FACTOR_COOKIE: "La verificación ha caducado. Vuelve a iniciar sesión.",
  TOTP_ALREADY_ENABLED: "El 2FA ya está activado.",
  SESSION_NOT_FRESH: "Por seguridad, cierra sesión y vuelve a entrar para hacer este cambio.",
};

export function traducirError(error: ErrorAuth | null | undefined): string {
  if (error?.status === 429) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  return (error?.code && MENSAJES[error.code]) || "Algo ha ido mal. Inténtalo de nuevo.";
}

export function Campo({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
  hint,
  inputMode,
  maxLength,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  minLength?: number;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        minLength={minLength}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={INPUT_CLASS}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Mensaje({ tipo, children }: { tipo: "error" | "ok"; children: ReactNode }) {
  return tipo === "error" ? (
    <p role="alert" className="text-sm font-semibold text-red-400">
      {children}
    </p>
  ) : (
    <p role="status" className="text-sm font-semibold text-emerald-400">
      {children}
    </p>
  );
}

/** Contenedor de las pantallas de acceso: estrecho y centrado. */
export function Panel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="section mx-auto max-w-md">
      <h2 className="mb-5 font-display text-3xl font-black uppercase italic">{titulo}</h2>
      {children}
    </section>
  );
}
