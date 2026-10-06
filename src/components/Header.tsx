"use client";

import { usePathname } from "next/navigation";
import { Menu, Search, ChevronDown } from "lucide-react";

// Enlaces del menú. `href` "#" = página aún sin crear (nunca se marca activa).
// Para añadir una página nueva basta con una línea más aquí.
const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Calendario", href: "/calendario" },
  { label: "Pilotos", href: "#" },
  { label: "Equipos", href: "#" },
  { label: "Circuitos", href: "#" },
];

// "/" solo es activo en la portada exacta; el resto, también en sus subrutas.
function isActive(href: string, pathname: string) {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2 font-black tracking-tight text-xl">
            <span className="h-6 w-1.5 rounded bg-red-600" />
            MOTO<span className="text-red-600">GP</span><span className="text-zinc-500">STATS</span>
          </div>
          <nav className="hidden gap-7 text-sm text-zinc-400 md:flex">
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
          <Menu size={21} className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
