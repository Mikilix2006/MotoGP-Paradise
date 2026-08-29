import { Menu, Search, ChevronDown } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2 font-black tracking-tight text-xl">
            <span className="h-6 w-1.5 rounded bg-red-600" />
            MOTO<span className="text-red-600">GP</span><span className="text-zinc-500">STATS</span>
          </div>
          <nav className="hidden gap-7 text-sm text-zinc-400 md:flex">
            <a className="text-white" href="#">Inicio</a><a href="#">Calendario</a><a href="#">Pilotos</a><a href="#">Equipos</a><a href="#">Circuitos</a>
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
