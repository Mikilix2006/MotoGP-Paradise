import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 px-5 py-5 text-center text-xs tracking-wide text-zinc-500">
      {SITE_NAME} · Proyecto personal sin ánimo de lucro · No afiliado a MotoGP ·{" "}
      <Link
        href="/aviso-legal"
        className="rounded-sm font-semibold text-zinc-400 underline underline-offset-4 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-red-500/50"
      >
        Aviso legal
      </Link>
    </footer>
  );
}
