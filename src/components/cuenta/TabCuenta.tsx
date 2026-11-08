"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { applyAccent } from "@/lib/accentClient";
import { authClient } from "@/lib/authClient";
import type { UsuarioPublico } from "@/lib/session";

import { LABEL_CLASS } from "./ui";
import { refrescarEstado } from "./useEstadoCuenta";

export default function TabCuenta({ usuario }: { usuario: UsuarioPublico }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await authClient.signOut();
    applyAccent(null);
    await refrescarEstado();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className={LABEL_CLASS}>Alias</dt>
          <dd className="text-lg font-semibold text-white">{usuario.alias}</dd>
        </div>
        <div className="min-w-0">
          <dt className={LABEL_CLASS}>Correo</dt>
          <dd className="truncate text-lg font-semibold text-white">{usuario.email}</dd>
        </div>
      </dl>
      <button type="button" onClick={salir} disabled={saliendo} className="btn-ghost disabled:opacity-60">
        {saliendo ? "Cerrando…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
