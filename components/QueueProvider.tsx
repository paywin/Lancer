"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { abrirFila, type Fila, type Trabalho } from "@/lib/queue";

const Context = createContext<Fila | null>(null);
const EMPTY: Trabalho[] = [];
const noop = () => () => {};
export function useFila() {
  const fila = useContext(Context);
  const jobs = useSyncExternalStore(fila?.subscribe ?? noop, fila?.snapshot ?? (() => EMPTY), () => EMPTY);
  return { fila, jobs };
}

export function QueueProvider({ owner, children }: { owner?: string | null; children: React.ReactNode }) {
  const [fila, setFila] = useState<Fila | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!owner) return;
    let stopped = false;
    let release: (() => void) | undefined;
    const abort = new AbortController();
    // One active tab per account prevents two browser workers writing the same local queue.
    if (!navigator.locks) { setErro("A fila precisa de um navegador atualizado e conexão HTTPS (ou localhost)."); return; }
    void navigator.locks.request(`lancanota:${owner}`, { signal: abort.signal }, async () => {
      if (stopped) return;
      const held = new Promise<void>((resolve) => { release = resolve; });
      try {
        const next = await abrirFila(owner);
        if (!stopped) setFila(next);
        else release?.();
        await held;
        await next.stop();
      } catch (e) { if (!stopped) setErro((e as Error).message); }
    }).catch((e) => { if (!stopped) setErro(e.message); });
    return () => { stopped = true; abort.abort(); release?.(); };
  }, [owner]);
  return <Context.Provider value={fila}>
    {owner && <QueueBanner erro={erro} />}
    {children}
  </Context.Provider>;
}

function QueueBanner({ erro }: { erro: string }) {
  const { fila, jobs } = useFila();
  const pending = jobs.filter((j) => j.status === "aguardando").length;
  const ready = jobs.filter((j) => j.status === "revisar").length;
  const active = jobs.some((j) => j.status === "processando");
  return <div className="mb-4 rounded-xl border border-border bg-card p-3 text-sm" aria-live="polite">
    {erro || fila?.error ? <p role="alert" className="text-red-600">{erro || fila?.error}</p> :
      <Link href="/fila" className="flex flex-wrap justify-between gap-2"><span>{!fila ? "Carregando fila (feche outras abas do app)…" : active ? "⏳ Processando uma nota" : "Fila de notas"}</span><span>{pending} aguardando · {ready} para revisar →</span></Link>}
  </div>;
}
