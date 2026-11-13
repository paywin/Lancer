import { describe, it, expect, vi } from "vitest";
import { Fila, type QueueIO, type Trabalho } from "@/lib/queue";
import { ApiError, type Extracao } from "@/lib/client";

const result: Extracao = { nota: { numeroNf: "1", fornecedor: "A", dataEmissao: "2026-11-12", origem: "qrcode", itens: [{ produto: "A", quantidade: 1, unidade: "UN", precoUnit: 10, total: 10 }] }, duplicada: null, alertas: [] };
function fixture(initial: Trabalho[] = []) {
  let saved = structuredClone(initial);
  const io: QueueIO = { read: async () => structuredClone(saved), write: async (next) => { saved = structuredClone(next); }, extract: vi.fn(async () => structuredClone(result)), send: vi.fn(async () => ({})) };
  return { io, saved: () => saved };
}
const pending = (id: string): Trabalho => ({ id, criadoEm: "now", nome: id, status: "aguardando", entrada: { tipo: "qrcode", conteudo: id } });
const ready = (id: string): Trabalho => ({ ...pending(id), status: "revisar", resultado: structuredClone(result) });

describe("fila persistente", () => {
  it("permite capturar enquanto processa, executa apenas uma extração e continua após falha", async () => {
    const fx = fixture();
    let resolve!: (r: Extracao) => void;
    fx.io.extract = vi.fn().mockImplementationOnce(() => new Promise<Extracao>((r) => { resolve = r; })).mockRejectedValueOnce(new Error("SEFAZ indisponível")).mockResolvedValue(result);
    const queue = new Fila(fx.io); await queue.init();
    await queue.add("primeira", { tipo: "qrcode", conteudo: "a" });
    await vi.waitFor(() => expect(fx.io.extract).toHaveBeenCalledTimes(1));
    await queue.add("segunda", { tipo: "qrcode", conteudo: "b" });
    await queue.add("terceira", { tipo: "qrcode", conteudo: "c" });
    expect(fx.io.extract).toHaveBeenCalledTimes(1);
    expect(fx.saved().filter((j) => j.status === "aguardando")).toHaveLength(2);
    resolve(result);
    await vi.waitFor(() => expect(queue.jobs.map((j) => j.status)).toEqual(["revisar", "erro", "revisar"]));
  });
  it("recupera processamento interrompido e mantém edições após reabrir", async () => {
    const fx = fixture([{ ...pending("a"), status: "processando" }, ready("b")]);
    const queue = new Fila(fx.io); await queue.init();
    await queue.edit("b", (n) => ({ ...n, fornecedor: "Corrigido" }));
    await queue.stop();
    const restored = new Fila(fx.io); await restored.init();
    expect(restored.jobs.find((j) => j.id === "b")?.resultado?.nota.fornecedor).toBe("Corrigido");
    await vi.waitFor(() => expect(restored.jobs[0].status).toBe("revisar"));
  });
  it("repete envio incerto com o mesmo ID e conteúdo, impedindo edição", async () => {
    const fx = fixture([ready("a")]);
    fx.io.send = vi.fn().mockRejectedValueOnce(new Error("Conexão perdida")).mockResolvedValue({});
    const queue = new Fila(fx.io); await queue.init();
    await expect(queue.send("a")).rejects.toThrow("Conexão perdida");
    await queue.edit("a", (n) => ({ ...n, fornecedor: "não deve mudar" }));
    expect(queue.jobs[0].resultado?.nota.fornecedor).toBe("A");
    const restored = new Fila(fx.io); await restored.init();
    await restored.send("a");
    const calls = vi.mocked(fx.io.send).mock.calls;
    expect(calls[0][0].id).toBe(calls[1][0].id);
    expect(calls[0][0].envio).toEqual(calls[1][0].envio);
    expect(restored.jobs[0].status).toBe("concluido");
  });
  it("marca conflito como duplicada e libera revisão", async () => {
    const fx = fixture([ready("a")]); fx.io.send = vi.fn().mockRejectedValue(new ApiError(409, "Duplicada"));
    const queue = new Fila(fx.io); await queue.init();
    await expect(queue.send("a")).rejects.toThrow("Duplicada");
    expect(queue.jobs[0].envio).toBeUndefined();
    expect(queue.jobs[0].resultado?.duplicada).toBeTruthy();
  });
  it("não mostra uma captura como salva quando o armazenamento falha", async () => {
    const fx = fixture(); const queue = new Fila(fx.io); await queue.init();
    fx.io.write = async () => { throw new Error("Sem espaço"); };
    await expect(queue.add("a", { tipo: "xml", xml: "<NFe/>" })).rejects.toThrow("Sem espaço");
    expect(queue.jobs).toHaveLength(0);
  });
});
