"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Lanc = { nf: string; fornecedor: string; data: string; itens: number; total: number; origem: string; lancadoPor: string; lancadoEm: string };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso?.split("-").reverse().join("/");

export function RecentList() {
  const [lista, setLista] = useState<Lanc[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<{ lancamentos: Lanc[] }>("/api/sheets/recent")
      .then((r) => setLista(r.lancamentos))
      .catch((e) => setErro(e.message));
  }, []);

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-muted">Últimos lançamentos</h2>
      <div className="card divide-y divide-border p-0">
        {erro && <p className="p-4 text-sm text-muted">Não foi possível carregar: {erro}</p>}
        {!erro && lista === null && <p className="p-4 text-sm text-muted">Carregando…</p>}
        {lista?.length === 0 && <p className="p-4 text-sm text-muted">Nenhuma nota lançada ainda.</p>}
        {lista?.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{l.fornecedor}</p>
              <p className="text-muted">NF {l.nf} · {dataBr(l.data)} · {l.itens} itens · {l.origem}</p>
            </div>
            <p className="shrink-0 font-medium tabular-nums">{brl(l.total || 0)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
