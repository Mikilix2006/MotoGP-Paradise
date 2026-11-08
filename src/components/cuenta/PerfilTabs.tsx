"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import type { UsuarioPublico } from "@/lib/session";

import TabApariencia from "./TabApariencia";
import TabCuenta from "./TabCuenta";
import TabProximamente from "./TabProximamente";
import TabSeguridad from "./TabSeguridad";

const TABS = [
  { id: "cuenta", label: "Cuenta" },
  { id: "apariencia", label: "Apariencia" },
  { id: "seguridad", label: "Seguridad" },
  { id: "predicciones", label: "Predicciones" },
  { id: "notificaciones", label: "Notificaciones" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PerfilTabs({ usuario }: { usuario: UsuarioPublico }) {
  const [activa, setActiva] = useState<TabId>("cuenta");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Flechas izquierda/derecha entre pestañas (patrón WAI-ARIA tabs).
  function onKeyDown(e: KeyboardEvent, i: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = TABS[(i + delta + TABS.length) % TABS.length];
    setActiva(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <section className="section">
      <div role="tablist" aria-label="Secciones del perfil" className="flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={activa === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={activa === t.id ? 0 : -1}
            onClick={() => setActiva(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`shrink-0 ${activa === t.id ? "btn-race" : "btn-ghost"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`panel-${activa}`} role="tabpanel" aria-labelledby={`tab-${activa}`} className="pt-6">
        {activa === "cuenta" && <TabCuenta usuario={usuario} />}
        {activa === "apariencia" && <TabApariencia usuario={usuario} />}
        {activa === "seguridad" && <TabSeguridad usuario={usuario} />}
        {activa === "predicciones" && <TabProximamente texto="Aquí guardaremos tus predicciones de cada Gran Premio y los puntos que vayas sumando." />}
        {activa === "notificaciones" && <TabProximamente texto="Podrás elegir en qué sesiones y categorías quieres que te avisemos justo antes de que empiecen." />}
      </div>
    </section>
  );
}
