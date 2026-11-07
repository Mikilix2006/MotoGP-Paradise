export function formatPosition(position: number | null): string {
  if (position === null) {
    return "—";
  }

  return `${position}º`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}
