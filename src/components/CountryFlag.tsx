"use client";

import { useRef, useState } from "react";

// Lienzo común de las SVG de banderas de MotoGP: la bandera real va centrada
// con franjas transparentes arriba y abajo (y, en alguna, también a los lados).
const FLAG_CANVAS_W = 162;
const FLAG_CANVAS_H = 116;

// Zona pintada de la bandera, en unidades del lienzo.
type FlagFit = { top: number; height: number; left: number; width: number };

// Caché de módulo: resultado de medir cada SVG por URL. Evita redibujar y
// escanear la misma bandera (España pesa ~146 KB y sale en varias filas).
// Solo guarda la medición; el estado de carga/error sigue siendo por instancia.
const fitCache = new Map<string, FlagFit | "fallback">();

// Mide el rectángulo realmente pintado (filas y columnas con alfa > 10).
function measureFlag(img: HTMLImageElement): FlagFit | null {
  const canvas = document.createElement("canvas");
  canvas.width = FLAG_CANVAS_W;
  canvas.height = FLAG_CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, FLAG_CANVAS_W, FLAG_CANVAS_H);
  const { data } = ctx.getImageData(0, 0, FLAG_CANVAS_W, FLAG_CANVAS_H);
  let top = FLAG_CANVAS_H;
  let bottom = -1;
  let left = FLAG_CANVAS_W;
  let right = -1;
  for (let y = 0; y < FLAG_CANVAS_H; y++) {
    for (let x = 0; x < FLAG_CANVAS_W; x++) {
      if (data[(y * FLAG_CANVAS_W + x) * 4 + 3] > 10) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return null;
  return {
    top,
    height: bottom - top + 1,
    left,
    width: right - left + 1,
  };
}

// "md": bandera de las cards del calendario (h-7 w-10). "sm": bandera compacta
// para filas de tabla (h-4 w-6).
const SIZES = {
  md: {
    box: "h-7 w-10 rounded-md",
    pill: "rounded-full px-2.5 py-1 text-xs font-medium",
  },
  sm: {
    box: "h-4 w-6 rounded-sm",
    pill: "flex h-4 w-6 items-center justify-center rounded-sm text-[9px] font-bold leading-none",
  },
} as const;

// Bandera del país. Recorte tipo "cover" sobre la zona pintada: la escala es la
// mayor entre llenar el alto y llenar el ancho de la caja, así que nunca quedan
// huecos del fondo. Con banderas más apaisadas que la caja llena el alto y se
// recorta por los lados; con las menos apaisadas llena el ancho y pierde unas
// décimas de píxel arriba y abajo. Si no se puede medir, object-cover; si no hay
// URL o falla la carga, el código ISO en una pill.
export default function CountryFlag({
  url,
  iso,
  name,
  size = "md",
}: {
  url: string | null;
  iso: string;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const [fit, setFit] = useState<"pending" | "fallback" | FlagFit>(
    () => (url ? fitCache.get(url) : undefined) ?? "pending"
  );
  const measured = useRef(false);
  const sizes = SIZES[size];

  if (!url || failed) {
    return (
      <span
        title={name}
        className={`shrink-0 border border-white/10 bg-white/5 text-zinc-400 ${sizes.pill}`}
      >
        {iso}
      </span>
    );
  }

  function handleLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    if (measured.current || !url) return;
    measured.current = true;
    const cached = fitCache.get(url);
    if (cached) {
      setFit(cached);
      return;
    }
    let result: FlagFit | "fallback";
    try {
      result = measureFlag(event.currentTarget) ?? "fallback";
    } catch {
      // Lienzo contaminado (CORS) u otro fallo: se usa object-cover.
      result = "fallback";
    }
    fitCache.set(url, result);
    setFit(result);
  }

  const ajustada = typeof fit === "object";

  return (
    <span
      title={size === "sm" ? name : undefined}
      className={`relative block shrink-0 overflow-hidden border border-white/10 bg-white/5 ${sizes.box}`}
      // Contenedor de tamaño: las unidades cqw/cqh de la imagen miden el
      // interior real de la caja, sea cual sea su tamaño (también responsivo).
      style={ajustada ? { containerType: "size" } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        crossOrigin="anonymous"
        alt={`Bandera de ${name}`}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={() => setFailed(true)}
        className={
          ajustada
            ? "absolute max-w-none"
            : `h-full w-full object-cover ${fit === "pending" ? "opacity-0" : ""}`
        }
        style={
          ajustada
            ? ({
                // Píxeles por unidad de lienzo: cover sobre la zona pintada.
                "--s": `max(calc(100cqh / ${fit.height}), calc(100cqw / ${fit.width}))`,
                // Lienzo completo escalado y centrado sobre el centro de la zona pintada.
                width: `calc(${FLAG_CANVAS_W} * var(--s))`,
                height: `calc(${FLAG_CANVAS_H} * var(--s))`,
                left: `calc(50cqw - ${fit.left + fit.width / 2} * var(--s))`,
                top: `calc(50cqh - ${fit.top + fit.height / 2} * var(--s))`,
              } as React.CSSProperties)
            : undefined
        }
      />
    </span>
  );
}
