export function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="card p-5">
    <p className="text-xs uppercase tracking-[.18em] text-zinc-500">{label}</p>
    <p className="mt-3 text-3xl font-black">{value}</p>
    <p className="mt-2 text-sm text-zinc-500">{note}</p>
  </div>;
}
