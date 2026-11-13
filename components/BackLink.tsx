import Link from "next/link";

export function PageHeader({ titulo, voltar = "/" }: { titulo: string; voltar?: string }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <Link href={voltar} className="rounded-lg px-2 py-1 text-xl text-muted" aria-label="Voltar">←</Link>
      <h1 className="text-lg font-semibold">{titulo}</h1>
    </header>
  );
}
