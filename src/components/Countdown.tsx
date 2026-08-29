"use client";

import { useEffect, useState } from "react";
import { getMadridTimestamp } from "@/utils/date";

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
const target = getMadridTimestamp(targetDate);
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

return ( <div className="mt-10 grid grid-cols-4 gap-3"> <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center"> <p className="text-2xl font-black md:text-3xl">
{formatNumber(timeRemaining.days)} </p>

    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
      Días
    </p>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
    <p className="text-2xl font-black md:text-3xl">
      {formatNumber(timeRemaining.hours)}
    </p>

    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
      Horas
    </p>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
    <p className="text-2xl font-black md:text-3xl">
      {formatNumber(timeRemaining.minutes)}
    </p>

    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
      Minutos
    </p>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
    <p className="text-2xl font-black md:text-3xl">
      {formatNumber(timeRemaining.seconds)}
    </p>

    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
      Segundos
    </p>
  </div>
</div>

);
}
