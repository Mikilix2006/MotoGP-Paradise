import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <main className="flex-1">
      <Header />
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        <p className="eyebrow text-xs font-bold uppercase tracking-widest text-red-500">Error 404</p>
        <h1 className="page-title mt-3 text-5xl font-display font-black md:text-7xl">Te has salido de la trazada</h1>
        <p className="mt-5 max-w-md text-zinc-400">La página que buscas no existe o ha cambiado de sitio. Vuelve a la pista y sigue la carrera.</p>
        <Link href="/" className="btn-race mt-8 inline-flex">Volver al inicio</Link>
      </section>
    </main>
  );
}
