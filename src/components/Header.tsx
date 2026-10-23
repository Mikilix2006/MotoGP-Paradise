"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Menu, X } from "lucide-react";

// Enlaces del menú. `href` "#" = página aún sin crear (nunca se marca activa).
// Para añadir una página nueva basta con una línea más aquí.
const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Calendario", href: "/calendario" },
  { label: "Pilotos", href: "/pilotos" },
  { label: "Equipos", href: "#" },
  { label: "Predicciones", href: "#" },
];

// "/" solo es activo en la portada exacta; el resto, también en sus subrutas.
function isActive(href: string, pathname: string) {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Anillo de foco del sistema (rojo sutil), reutilizado por logo, botón y enlaces.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";

const MENU_ID = "menu-movil";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Si cambia la ruta, el menú se cierra (ajuste de estado durante el render).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    // Si el viewport pasa a escritorio (md), no debe quedar estado abierto colgado.
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Escape cierra y devuelve el foco al botón.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Pulsar fuera del header (contenido de la página) cierra el menú.
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-20 border-b-[3px] border-red-600 bg-[var(--surface)] shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-10">
          <a
            href="/"
            aria-label="MotoGP Stats, ir al inicio"
            className={`flex items-center gap-2 rounded-md font-display text-2xl font-black italic tracking-tight md:text-3xl ${FOCUS_RING}`}
          >
            MOTO<span className="cut -ml-1 bg-[image:var(--accent-grad)] px-2 pr-3 text-[#fff]">GP</span><span className="text-zinc-500">STATS</span>
          </a>
          {/* self-stretch + -my-4: el nav ocupa todo el alto del header para que el semicírculo
              del enlace activo toque justo el borde superior. */}
          <nav aria-label="Menú principal" className="-my-4 hidden gap-7 self-stretch font-display text-lg font-bold uppercase tracking-wider text-zinc-400 md:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href, pathname);
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className={`relative flex items-center transition-colors hover:text-white motion-reduce:transition-none ${active ? "text-white" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                  {active && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-0 bottom-0 h-[4px] w-full -skew-x-[30deg] bg-red-600"
                    />
                  )}
                </a>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden min-h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 font-display text-base font-bold tracking-wider text-zinc-300 md:flex">2026</button>
          <ThemeToggle />
          {/* Zona táctil de ~45 px (21 + 2×12) sin alterar la maquetación (margen negativo). */}
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
            className={`-m-3 p-3 text-sm font-bold text-white md:hidden ${FOCUS_RING}`}
          >
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>
      {/* Panel móvil: superpuesto bajo el header (no empuja el contenido). Misma animación que
          los desplegables de las cards: grid-rows 0fr↔1fr + opacidad; plegado = invisible. */}
      <div
        id={MENU_ID}
        className={`absolute inset-x-0 top-full grid bg-[var(--surface)] transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none md:hidden ${
          open
            ? "visible opacity-100 grid-rows-[1fr]"
            : "invisible opacity-0 grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav aria-label="Menú principal" className="flex flex-col border-b-[3px] border-red-600 bg-[var(--surface)] py-2 font-display text-lg font-bold uppercase tracking-wider shadow-lg">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href, pathname);
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center border-l-2 px-5 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50 ${
                    active
                      ? "border-red-600 bg-white/5 font-semibold text-white"
                      : "border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-white active:bg-white/5"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
