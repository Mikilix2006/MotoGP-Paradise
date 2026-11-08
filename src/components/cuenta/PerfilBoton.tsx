"use client";

import Link from "next/link";
import { User } from "lucide-react";

import { FOCUS_RING } from "./ui";
import { useEstadoCuenta } from "./useEstadoCuenta";

const CLASE = `cut flex min-h-9 items-center gap-2 bg-[image:var(--accent-grad)] pl-3 pr-5 font-display text-sm font-black uppercase tracking-wider text-[#fff] shadow-md ${FOCUS_RING}`;

/**
 * Botón de perfil del header. Sin cuentas abiertas (REGISTRO_ABIERTO apagado) es un marcador
 * «próximamente»; con ellas, lleva a /acceso o a /perfil con el alias del usuario.
 */
export default function PerfilBoton() {
  const estado = useEstadoCuenta();

  if (estado?.abierto) {
    const usuario = estado.usuario;
    return (
      <Link href={usuario ? "/perfil" : "/acceso"} className={CLASE} aria-label={usuario ? `Mi perfil, ${usuario.alias}` : "Acceder o crear cuenta"}>
        <User size={18} aria-hidden />
        <span className="hidden max-w-[8rem] truncate md:inline">{usuario ? usuario.alias : "Acceder"}</span>
      </Link>
    );
  }

  // Mientras se consulta el estado se reserva el hueco sin mostrarlo (no hay salto de diseño).
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label="Perfil (próximamente)"
      title="Perfil (próximamente)"
      tabIndex={estado ? 0 : -1}
      className={`${CLASE} cursor-default ${estado ? "" : "invisible"}`}
    >
      <User size={18} aria-hidden />
      <span className="hidden md:inline">Perfil</span>
    </button>
  );
}
