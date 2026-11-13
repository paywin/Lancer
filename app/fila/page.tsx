"use client";
import Link from "next/link";
import { useState } from "react";
import { useFila } from "@/components/QueueProvider";
import { PageHeader } from "@/components/BackLink";
import { ErrorBox } from "@/components/ErrorBox";

const labels = { aguardando: "Aguardando", processando: "Processando…", revisar: "Pronta para revisar", erro: "Falha na leitura", enviando: "Lançando…", concluido: "Lançada" };
export default function FilaPage() {
  const { fila, jobs } = useFila();
  const [erro, setErro] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => { setErro(null); void p.catch((e) => setErro(e.message)); };
  return <div className="space-y-4"><PageHeader titulo="Fila de notas" />
    <p className="text-sm text-muted">Continue capturando enquanto uma nota é lida por vez. Revise cada nota antes de lançar. A fila fica salva neste navegador; mantenha o app aberto para processar. Ao reabrir, ele retoma as pendências.</p>
    <div className="grid grid-cols-3 gap-2"><Link className="btn-primary" href="/lancar/qrcode">QR Code</Link><Link className="btn-ghost" href="/lancar/foto">Fotos</Link><Link className="btn-ghost" href="/lancar/xml">XML</Link></div>
    <ErrorBox msg={erro} />
    {!jobs.length && <p className="card">{fila ? "Nenhuma nota na fila." : "Carregando…"}</p>}
    {jobs.map((j) => <article className="card space-y-2" key={j.id}>
      <div className="flex justify-between gap-3"><strong>{j.resultado?.nota.fornecedor || j.nome}</strong><span className="text-sm text-muted">{labels[j.status]}</span></div>
      <p className="text-sm text-muted">{j.resultado?.nota.numeroNf ? `NF ${j.resultado.nota.numeroNf} · ` : ""}{j.nome}</p>
      <ErrorBox msg={j.erro ?? null} />
      <div className="flex flex-wrap gap-2">
        {j.status === "revisar" && <Link className="btn-primary" href={`/lancar/revisar?id=${j.id}`}>Revisar nota</Link>}
        {j.status === "erro" && <><button className="btn-primary" onClick={() => run(fila!.retry(j.id))}>Tentar de novo</button><Link className="btn-ghost" href="/lancar/foto">Enviar por foto</Link></>}
        {!["processando", "enviando"].includes(j.status) && !j.envio && <button className="btn-ghost" onClick={() => { if (j.status === "concluido" || confirm("Remover esta nota da fila?")) run(fila!.remove(j.id)); }}>{j.status === "concluido" ? "Remover da fila" : "Descartar"}</button>}
      </div>
    </article>)}
  </div>;
}
