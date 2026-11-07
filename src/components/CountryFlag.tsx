"use client";

import { useState } from "react";

// "md": bandera de las cards del calendario (h-7, 4:3). "sm": bandera compacta
// para filas de tabla (h-4, 4:3).
const SIZES = {
  md: {
    box: "aspect-[4/3] h-7 rounded-md",
    pill: "rounded-full px-2.5 py-1 text-xs font-medium",
  },
  sm: {
    box: "aspect-[4/3] h-4 rounded-sm",
    pill: "flex h-4 w-6 items-center justify-center rounded-sm text-[9px] font-bold leading-none",
  },
} as const;

// Archivo local de la bandera: el nombre sale de `url`; "smr" (San Marino) -> sm;
// dos mayúsculas se respetan (hay eventos con SM o IN distintos del país); si no, `iso`.
function flagSrc(url: string | null, iso: string) {
  const file = url?.split("/").pop()?.replace(/\.svg$/, "") ?? "";
  const code = file === "smr" ? "sm" : /^[A-Z]{2}$/.test(file) ? file.toLowerCase() : iso.toLowerCase();
  return `/flags/${code}.svg`;
}

// Bandera del país (SVG local, object-cover). Si la imagen falla, el código ISO en una pill.
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
  const sizes = SIZES[size];

  if (failed) {
    return (
      <span
        title={name}
        className={`shrink-0 border border-white/10 bg-white/5 text-zinc-400 ${sizes.pill}`}
      >
        {iso}
      </span>
    );
  }

  return (
    <span
      title={size === "sm" ? name : undefined}
      className={`relative block shrink-0 overflow-hidden border border-white/10 bg-white/5 ${sizes.box}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={flagSrc(url, iso)}
        alt={`Bandera de ${name}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
