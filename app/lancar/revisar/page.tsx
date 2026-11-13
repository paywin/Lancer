"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/BackLink";
import { ErrorBox } from "@/components/ErrorBox";
import { NumInput } from "@/components/NumInput";
import { useFila } from "@/components/QueueProvider";
import { validarNota } from "@/lib/validate";
import type { Item, NotaExtraida } from "@/lib/schema";
import { round } from "@/lib/mapToRows";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function Page() { return <Suspense fallback={<p>Carregando revisão…</p>}><Revisar /></Suspense>; }
function Revisar() {
  const { fila, jobs } = useFila();
  const params = useSearchParams();
  const job = params.get("id") ? jobs.find((j) => j.id === params.get("id")) : jobs.find((j) => j.status === "revisar");
  const nota = job?.resultado?.nota;
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarDuplicada, setConfirmarDuplicada] = useState(false);
  if (!job || !nota || job.status === "concluido") return <div className="space-y-4"><PageHeader titulo="Revisar nota" /><p className="card">{job?.status === "concluido" ? "Nota lançada com sucesso." : !fila ? "Carregando fila…" : "Nenhuma nota pronta para revisar."}</p><Link className="btn-primary w-full" href="/fila">Voltar à fila</Link></div>;
  const editar = (fn: (n: NotaExtraida) => NotaExtraida) => { setErro(null); void fila!.edit(job.id, fn).catch((e) => setErro(e.message)); };
  const campo = <K extends keyof NotaExtraida>(k: K, value: NotaExtraida[K]) => editar((n) => ({ ...n, [k]: value }));
  const item = (index: number, patch: Partial<Item>, calcular = false) => editar((n) => ({ ...n, itens: n.itens.map((it, i) => {
    if (i !== index) return it;
    const next = { ...it, ...patch };
    if (calcular) next.total = round(next.quantidade * next.precoUnit - (next.desconto ?? 0), 2);
    return next;
  }) }));
  const alertas = validarNota(nota);
  const duplicada = !!job.resultado?.duplicada;
  const enviando = job.status === "enviando";
  const bloqueado = enviando || !!job.envio;
  const soma = nota.itens.reduce((s, i) => s + i.total, 0);
  async function enviar() {
    setErro(null);
    try { await fila!.send(job!.id, duplicada && confirmarDuplicada); }
    catch (e) { setErro((e as Error).message); setConfirmarDuplicada(false); }
  }
  return <div className="space-y-4 pb-36"><PageHeader titulo="Revisar nota" />
    <p className="text-sm text-muted">As alterações são salvas neste navegador. Valores dos itens representam o total após desconto do item; frete e outros acréscimos ficam refletidos no total da nota.</p>
    {job.envio && !enviando && <p role="alert" className="card text-amber-700">O resultado do envio anterior precisa ser confirmado. Repita o envio com os mesmos dados; o sistema verifica se já foi gravado.</p>}
    <fieldset disabled={bloqueado} className="card grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">Fornecedor<input className="input" value={nota.fornecedor} onChange={(e) => campo("fornecedor", e.target.value)} /></label>
      <label>Nº da NF<input className="input" value={nota.numeroNf} onChange={(e) => campo("numeroNf", e.target.value)} /></label>
      <label>Série<input className="input" value={nota.serie ?? ""} onChange={(e) => campo("serie", e.target.value)} /></label>
      <label>Data de emissão<input className="input" type="date" value={nota.dataEmissao} onChange={(e) => campo("dataEmissao", e.target.value)} /></label>
      <label>CNPJ/CPF do fornecedor<input className="input" value={nota.cnpjFornecedor ?? ""} onChange={(e) => campo("cnpjFornecedor", e.target.value.replace(/\D/g, ""))} /></label>
      <label className="sm:col-span-2">Chave de acesso<input className="input" value={nota.chaveAcesso ?? ""} onChange={(e) => campo("chaveAcesso", e.target.value.replace(/\D/g, "") || null)} /></label>
      <label>Total da nota (valor a pagar)<NumInput value={nota.valorTotalNota ?? soma} onChange={(v) => campo("valorTotalNota", v)} /></label>
    </fieldset>
    <fieldset disabled={bloqueado} className="space-y-3"><legend className="mb-2 font-medium">Itens ({nota.itens.length})</legend>
      {nota.itens.map((it, i) => <div key={i} className="card space-y-2">
        <div className="flex gap-2"><input aria-label={`Produto ${i + 1}`} className="input" value={it.produto} onChange={(e) => item(i, { produto: e.target.value })} /><button aria-label={`Remover item ${i + 1}`} className="btn-ghost" onClick={() => editar((n) => ({ ...n, itens: n.itens.filter((_, j) => i !== j) }))}>×</button></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <label>Quant.<NumInput value={it.quantidade} onChange={(v) => item(i, { quantidade: v }, true)} /></label>
          <label>U.M<input className="input" value={it.unidade} onChange={(e) => item(i, { unidade: e.target.value.toUpperCase() })} /></label>
          <label>Preço un.<NumInput value={it.precoUnit} onChange={(v) => item(i, { precoUnit: v }, true)} /></label>
          <label>Desconto<NumInput value={it.desconto ?? 0} onChange={(v) => item(i, { desconto: v }, true)} /></label>
          <label>Total<NumInput value={it.total} onChange={(v) => item(i, { total: v })} /></label>
        </div>
      </div>)}
      <button className="btn-ghost w-full" onClick={() => editar((n) => ({ ...n, itens: [...n.itens, { produto: "", quantidade: 1, unidade: "UN", precoUnit: 0, total: 0 }] }))}>+ Adicionar item</button>
    </fieldset>
    {alertas.map((a, i) => <p key={i} className={a.tipo === "erro" ? "text-red-600" : "text-amber-700"}>{a.mensagem}</p>)}
    <ErrorBox msg={erro || job.erro || null} />
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-4"><div className="mx-auto max-w-3xl space-y-2">
      {duplicada && !job.envio && <label className="flex gap-2 text-sm text-amber-700"><input type="checkbox" checked={confirmarDuplicada} onChange={(e) => setConfirmarDuplicada(e.target.checked)} />Esta nota já consta no controle. Confirmo que quero lançar uma cópia.</label>}
      <div className="flex items-center gap-3"><div className="text-sm">Itens: <strong>{brl(soma)}</strong><br />Nota: {brl(nota.valorTotalNota ?? soma)}</div>
        <button className="btn-primary flex-1" disabled={enviando || alertas.some((a) => a.tipo === "erro") || (duplicada && !confirmarDuplicada && !job.envio)} onClick={enviar}>{enviando ? "Lançando…" : job.envio ? "Confirmar envio anterior" : "Lançar na planilha"}</button></div>
      <Link className="block text-center text-sm underline" href="/fila">Voltar à fila</Link>
    </div></div>
  </div>;
}
