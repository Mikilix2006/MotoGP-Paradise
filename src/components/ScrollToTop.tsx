"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Botón flotante "Volver arriba": aparece tras bajar un poco.
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[image:var(--accent-grad)] text-lg text-[#fff] shadow-lg transition duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 motion-reduce:transition-none md:bottom-6 md:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={20} aria-hidden />
    </button>
  );
}
