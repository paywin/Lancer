import { api, ApiError, postJson, type Extracao } from "./client";
import type { NotaExtraida } from "./schema";

export type Entrada = { tipo: "qrcode"; conteudo: string } | { tipo: "foto"; imagens: string[] } | { tipo: "xml"; xml: string };
export type Trabalho = {
  id: string; nome: string; criadoEm: string; entrada?: Entrada;
  status: "aguardando" | "processando" | "revisar" | "erro" | "enviando" | "concluido";
  resultado?: Extracao; erro?: string;
  envio?: { nota: NotaExtraida; forcar: boolean };
};
export type QueueIO = {
  read: () => Promise<Trabalho[]>;
  write: (jobs: Trabalho[]) => Promise<void>;
  extract: (input: Entrada) => Promise<Extracao>;
  send: (job: Trabalho) => Promise<unknown>;
};

/** Mutations are serialized; extraction runs outside the mutation lock so capture stays available. */
export class Fila {
  jobs: Trabalho[] = [];
  error = "";
  loaded = false;
  private listeners = new Set<() => void>();
  private mutations: Promise<unknown> = Promise.resolve();
  private running = false;
  private closed = false;
  private drained: (() => void)[] = [];
  private sending = new Set<string>();
  constructor(private io: QueueIO) {}
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.jobs;
  private notify() { this.jobs = [...this.jobs]; this.listeners.forEach((fn) => fn()); }
  async stop() {
    this.closed = true;
    if (this.running || this.sending.size) await new Promise<void>((resolve) => this.drained.push(resolve));
    await this.mutations;
  }
  private settle() { if (!this.running && !this.sending.size) this.drained.splice(0).forEach((fn) => fn()); }
  async init() {
    this.jobs = (await this.io.read()).map((j) => ({ ...j,
      status: j.status === "processando" ? "aguardando" : j.status === "enviando" ? "revisar" : j.status,
    }));
    await this.io.write(this.jobs);
    this.loaded = true;
    this.notify();
    void this.pump();
  }
  private change(fn: (jobs: Trabalho[]) => Trabalho[]) {
    const task = this.mutations.then(async () => {
      const next = fn(this.jobs);
      await this.io.write(next);
      this.jobs = next;
      this.error = "";
      this.notify();
    });
    this.mutations = task.catch((e) => { this.error = `Não foi possível salvar a fila: ${e.message}`; this.notify(); });
    return task;
  }
  async add(nome: string, entrada: Entrada) {
    if (!this.loaded || this.closed) throw new Error("Aguarde a fila carregar.");
    if (this.jobs.filter((j) => j.status !== "concluido").length >= 50) throw new Error("A fila está cheia (50 notas). Conclua algumas antes de adicionar mais.");
    if (entrada.tipo === "qrcode" && this.jobs.some((j) => j.entrada?.tipo === "qrcode" && j.entrada.conteudo.trim() === entrada.conteudo.trim() && j.status !== "concluido")) throw new Error("Este QR Code já está na fila.");
    const job: Trabalho = { id: crypto.randomUUID(), nome, entrada, criadoEm: new Date().toISOString(), status: "aguardando" };
    await this.change((jobs) => [...jobs, job]);
    void this.pump();
    return job.id;
  }
  async edit(id: string, update: (nota: NotaExtraida) => NotaExtraida) {
    await this.change((jobs) => jobs.map((j) => j.id === id && j.status === "revisar" && j.resultado && !j.envio
      ? { ...j, resultado: { ...j.resultado, nota: update(j.resultado.nota) } } : j));
  }
  async remove(id: string) {
    await this.change((jobs) => jobs.filter((j) => j.id !== id || j.status === "processando" || j.status === "enviando" || !!j.envio));
  }
  async retry(id: string) {
    await this.change((jobs) => jobs.map((j) => j.id === id && j.status === "erro" && j.entrada ? { ...j, status: "aguardando", erro: undefined } : j));
    void this.pump();
  }
  async send(id: string, forcar = false) {
    if (this.sending.has(id)) return;
    this.sending.add(id);
    try {
      await this.change((jobs) => jobs.map((j) => j.id === id && j.status === "revisar" && j.resultado ?
        { ...j, status: "enviando", erro: undefined, envio: j.envio ?? { nota: j.resultado.nota, forcar } } : j));
      const job = this.jobs.find((j) => j.id === id);
      if (!job?.envio || job.status !== "enviando") return;
      try {
        await this.io.send(job);
        await this.change((jobs) => jobs.map((j) => j.id === id ? { ...j, status: "concluido", envio: undefined, entrada: undefined, erro: undefined } : j));
      } catch (e) {
        const definitive = e instanceof ApiError && [400, 401, 409, 422].includes(e.status);
        await this.change((jobs) => jobs.map((j) => j.id === id ? { ...j, status: "revisar", erro: (e as Error).message,
          envio: definitive ? undefined : j.envio,
          resultado: e instanceof ApiError && e.status === 409 && j.resultado ? { ...j.resultado, duplicada: { lancadoPor: "outro envio", lancadoEm: "anteriormente" } } : j.resultado,
        } : j));
        throw e;
      }
    } finally { this.sending.delete(id); this.settle(); }
  }
  async pump() {
    if (this.running || !this.loaded || this.closed) return;
    this.running = true;
    try {
      for (;;) {
        if (this.closed) break;
        const job = this.jobs.find((j) => j.status === "aguardando" && j.entrada);
        if (!job?.entrada) break;
        await this.change((jobs) => jobs.map((j) => j.id === job.id ? { ...j, status: "processando" } : j));
        try {
          const resultado = await this.io.extract(job.entrada);
          await this.change((jobs) => jobs.map((j) => j.id === job.id ? { ...j, status: "revisar", resultado, erro: undefined } : j));
        } catch (e) {
          await this.change((jobs) => jobs.map((j) => j.id === job.id ? { ...j, status: "erro", erro: (e as Error).message } : j));
        }
      }
    } catch (e) { this.error = (e as Error).message; this.notify(); }
    finally { this.running = false; this.settle(); }
  }
}

export async function abrirFila(owner: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`lancanota:${owner}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("fila");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const io: QueueIO = {
    read: () => new Promise((resolve, reject) => {
      const req = db.transaction("fila").objectStore("fila").get("jobs");
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    }),
    write: (jobs) => new Promise((resolve, reject) => {
      const tx = db.transaction("fila", "readwrite");
      tx.objectStore("fila").put(jobs, "jobs");
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Armazenamento indisponível"));
    }),
    extract: async (input) => {
      if (input.tipo === "qrcode") return postJson("/api/extract/qrcode", { conteudo: input.conteudo });
      if (input.tipo === "foto") return postJson("/api/extract/image", { imagens: input.imagens });
      const form = new FormData();
      form.append("arquivo", new File([input.xml], "nota.xml", { type: "text/xml" }));
      return api("/api/extract/xml", { method: "POST", body: form });
    },
    send: (job) => postJson("/api/sheets/append", { ...job.envio, requestId: job.id }),
  };
  const fila = new Fila(io);
  // Preserve drafts from the previous sessionStorage-only version in this browser tab.
  const legacy = sessionStorage.getItem("lancanota:fila");
  if (legacy) {
    let drafts: Extracao[] = [];
    try { const parsed = JSON.parse(legacy); if (Array.isArray(parsed)) drafts = parsed.filter((d) => d?.nota && Array.isArray(d.nota.itens)); } catch { /* Leave malformed legacy data untouched. */ }
    if (drafts.length) {
      const existing = await io.read();
      for (const draft of drafts) {
        if (existing.some((j) => JSON.stringify(j.resultado?.nota) === JSON.stringify(draft.nota))) continue;
        existing.push({ id: crypto.randomUUID(), nome: "Revisão recuperada", criadoEm: new Date().toISOString(), status: "revisar", resultado: draft });
      }
      await io.write(existing);
      sessionStorage.removeItem("lancanota:fila");
    }
  }
  await fila.init();
  return fila;
}
