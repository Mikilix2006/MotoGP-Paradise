"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
targetDate: string;
}

interface TimeRemaining {
days: number;
hours: number;
minutes: number;
seconds: number;
}

function calculateTimeRemaining(
targetDate: string
): TimeRemaining {
const target = new Date(targetDate).getTime();
const now = new Date().getTime();

const difference = Math.max(target - now, 0);

return {
days: Math.floor(
difference / (1000 * 60 * 60 * 24)
),

hours: Math.floor(
  (difference / (1000 * 60 * 60)) % 24
),

minutes: Math.floor(
  (difference / (1000 * 60)) % 60
),

seconds: Math.floor(
  (difference / 1000) % 60
),

};
}

function formatNumber(value: number) {
return value.toString().padStart(2, "0");
}

export function Countdown({
targetDate,
}: CountdownProps) {
const [timeRemaining, setTimeRemaining] =
useState<TimeRemaining>(() =>
calculateTimeRemaining(targetDate)
);

useEffect(() => {
const interval = setInterval(() => {
setTimeRemaining(
calculateTimeRemaining(targetDate)
);
}, 1000);

return () => clearInterval(interval);

}, [targetDate]);

return ( <div className="mt-10 grid grid-cols-4 gap-2 sm:gap-4"> <div className="rounded-xl bg-white px-1 py-3 text-center text-black shadow-md"> <p className="text-4xl font-display font-black italic tabular-nums md:text-6xl">
{formatNumber(timeRemaining.days)} </p>

    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-black/70">
      Días
    </p>
  </div>

  <div className="rounded-xl bg-white px-1 py-3 text-center text-black shadow-md">
    <p className="text-4xl font-display font-black italic tabular-nums md:text-6xl">
      {formatNumber(timeRemaining.hours)}
    </p>

    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-black/70">
      Horas
    </p>
  </div>

  <div className="rounded-xl bg-white px-1 py-3 text-center text-black shadow-md">
    <p className="text-4xl font-display font-black italic tabular-nums md:text-6xl">
      {formatNumber(timeRemaining.minutes)}
    </p>

    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-black/70">
      <span className="sm:hidden">Min</span>
      <span className="hidden sm:inline">Minutos</span>
    </p>
  </div>

  <div className="rounded-xl bg-white px-1 py-3 text-center text-black shadow-md">
    <p className="text-4xl font-display font-black italic tabular-nums md:text-6xl">
      {formatNumber(timeRemaining.seconds)}
    </p>

    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-black/70">
      <span className="sm:hidden">Seg</span>
      <span className="hidden sm:inline">Segundos</span>
    </p>
  </div>
</div>

);
}
