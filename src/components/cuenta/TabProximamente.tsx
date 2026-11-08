export default function TabProximamente({ texto }: { texto: string }) {
  return (
    <div className="py-6">
      <p className="tag">Próximamente</p>
      <p className="mt-3 max-w-prose text-sm text-zinc-400">{texto}</p>
    </div>
  );
}
