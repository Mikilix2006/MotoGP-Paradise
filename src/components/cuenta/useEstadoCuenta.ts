"use client";

import { useEffect, useState } from "react";

import { applyAccent } from "@/lib/accentClient";
import type { UsuarioPublico } from "@/lib/session";

export interface EstadoCuenta {
  abierto: boolean;
  usuario: UsuarioPublico | null;
}

// Una sola consulta por carga de página: las navegaciones dentro de la web reutilizan el resultado.
let cache: Promise<EstadoCuenta> | null = null;

async function pedirEstado(): Promise<EstadoCuenta> {
  try {
    const res = await fetch("/api/cuenta/estado", { cache: "no-store" });
    const { data } = (await res.json()) as { data: EstadoCuenta };
    // La cookie del acento puede no existir en este dispositivo: se sincroniza con la cuenta.
    if (data.usuario) applyAccent(data.usuario.tokens);
    return data;
  } catch {
    return { abierto: false, usuario: null };
  }
}

/** Fuerza una nueva lectura (tras iniciar o cerrar sesión, o cambiar el color). */
export function refrescarEstado(): Promise<EstadoCuenta> {
  cache = pedirEstado();
  return cache;
}

export function useEstadoCuenta(): EstadoCuenta | null {
  const [estado, setEstado] = useState<EstadoCuenta | null>(null);
  useEffect(() => {
    let vivo = true;
    (cache ??= pedirEstado()).then((e) => vivo && setEstado(e));
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}
