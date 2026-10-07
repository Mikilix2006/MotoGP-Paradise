"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, ChevronDown, X } from "lucide-react";

// Enlaces del menú. `href` "#" = página aún sin crear (nunca se marca activa).
// Para añadir una página nueva basta con una línea más aquí.
const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Calendario", href: "/calendario" },
  { label: "Pilotos", href: "#" },
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
    <header ref={headerRef} className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-10">
          <a
            href="/"
            aria-label="MotoGP Stats, ir al inicio"
            className={`flex items-center gap-2 rounded-md font-black tracking-tight text-xl ${FOCUS_RING}`}
          >
            <span className="h-6 w-1.5 rounded bg-red-600" />
            MOTO<span className="text-red-600">GP</span><span className="text-zinc-500">STATS</span>
          </a>
          <nav aria-label="Menú principal" className="hidden gap-7 text-sm text-zinc-400 md:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href, pathname);
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className={active ? "text-white" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 md:flex">2026 <ChevronDown size={15}/></button>
          <Search size={19} className="text-zinc-400" />
          {/* Zona táctil de ~45 px (21 + 2×12) sin alterar la maquetación (margen negativo). */}
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
            className={`-m-3 rounded-lg p-3 text-white md:hidden ${FOCUS_RING}`}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {/* Panel móvil: superpuesto bajo el header (no empuja el contenido). Misma animación que
          los desplegables de las cards: grid-rows 0fr↔1fr + opacidad; plegado = invisible. */}
      <div
        id={MENU_ID}
        className={`absolute inset-x-0 top-full grid bg-black/[.98] transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none md:hidden ${
          open
            ? "visible opacity-100 grid-rows-[1fr]"
            : "invisible opacity-0 grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav aria-label="Menú principal" className="flex flex-col border-b border-white/10 py-2 text-sm">
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
