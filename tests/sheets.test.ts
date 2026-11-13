import { beforeEach, describe, expect, it, vi } from "vitest";
import type { sheets_v4 } from "googleapis";
import { CONTROL_HEADER, SHEET_HEADER, type NotaExtraida } from "@/lib/schema";

const mock = vi.hoisted(() => ({
  markers: [] as sheets_v4.Schema$NamedRange[], batches: [] as sheets_v4.Schema$Request[][],
  rows: [] as unknown[][], fail: false, lost: false,
}));
vi.mock("@/lib/auth", () => ({ HttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("googleapis", () => ({ google: {
  auth: { JWT: class {} },
  sheets: () => ({ spreadsheets: {
    get: async () => ({ data: { sheets: [{ properties: { title: "lancaNota", sheetId: 12 } }, { properties: { title: "_controle", sheetId: 34 } }], namedRanges: structuredClone(mock.markers) } }),
    values: {
      batchGet: async () => ({ data: { valueRanges: [{ values: [[...SHEET_HEADER]] }, { values: [[...CONTROL_HEADER]] }] } }),
      get: async () => ({ data: { values: structuredClone(mock.rows) } }),
    },
    batchUpdate: async ({ requestBody }: { requestBody: { requests: sheets_v4.Schema$Request[] } }) => {
      const requests = requestBody.requests;
      if (mock.fail) throw new Error("API unavailable");
      const markers = requests.flatMap((r) => r.addNamedRange?.namedRange ? [r.addNamedRange.namedRange] : []);
      if (markers.some((m) => mock.markers.some((old) => old.namedRangeId === m.namedRangeId))) throw new Error("ID already exists");
      mock.markers.push(...structuredClone(markers));
      mock.batches.push(requests);
      const control = requests.find((r) => r.appendCells?.sheetId === 34)?.appendCells?.rows?.[0];
      if (control) mock.rows.push(control.values!.map((v) => v.userEnteredValue?.stringValue ?? v.userEnteredValue?.numberValue ?? ""));
      if (mock.lost) throw new Error("Response lost after commit");
      return {};
    },
  } }),
} }));
import { lancarNota, mesmaNota } from "@/lib/sheets";

const nota: NotaExtraida = { numeroNf: "001", serie: "2", fornecedor: "=1+1", cnpjFornecedor: "12345678000199", dataEmissao: "2026-11-12", valorTotalNota: 12, origem: "xml", itens: [{ produto: "=SUM(A1)", quantidade: 1, unidade: "UN", precoUnit: 10, total: 10 }] };
beforeEach(() => { mock.markers = []; mock.rows = []; mock.batches = []; mock.fail = false; mock.lost = false; process.env.SPREADSHEET_ID = "test"; process.env.SHEET_NAME = "lancaNota"; process.env.CONTROL_SHEET_NAME = "_controle"; });

describe("gravação atômica e idempotente", () => {
  it("grava produtos e controle juntos, com texto literal e total final da nota", async () => {
    await lancarNota(nota, "test@example.com", "request-1");
    expect(mock.batches).toHaveLength(1);
    const appends = mock.batches[0].filter((r) => r.appendCells);
    expect(appends.map((r) => r.appendCells?.sheetId)).toEqual([12, 34]);
    expect(appends[0].appendCells?.rows?.[0].values?.[4].userEnteredValue).toEqual({ stringValue: "=SUM(A1)" });
    expect(mock.rows[0][6]).toBe(12);
  });
  it("repete o mesmo envio sem duplicar, inclusive após perda da resposta", async () => {
    mock.lost = true;
    await expect(lancarNota(nota, "test@example.com", "request-1")).resolves.toEqual({ linhas: 1 });
    await lancarNota(nota, "test@example.com", "request-1");
    expect(mock.batches).toHaveLength(1);
  });
  it("rejeita a reutilização de um ID com dados diferentes", async () => {
    await lancarNota(nota, "test@example.com", "request-1");
    await expect(lancarNota({ ...nota, fornecedor: "outro" }, "test@example.com", "request-1")).rejects.toMatchObject({ status: 409 });
    expect(mock.batches).toHaveLength(1);
  });
  it("dois envios concorrentes da mesma nota gravam apenas uma vez", async () => {
    const results = await Promise.allSettled([lancarNota(nota, "a@example.com", "1"), lancarNota(nota, "b@example.com", "2")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(mock.batches).toHaveLength(1);
  });
  it("falha da API não deixa uma das abas gravada", async () => {
    mock.fail = true;
    await expect(lancarNota(nota, "test@example.com", "1")).rejects.toThrow("API unavailable");
    expect(mock.rows).toHaveLength(0);
    expect(mock.markers).toHaveLength(0);
  });
  it("cópia explícita continua idempotente nas tentativas", async () => {
    await lancarNota(nota, "test@example.com", "1");
    await lancarNota(nota, "test@example.com", "2", true);
    await lancarNota(nota, "test@example.com", "2", true);
    expect(mock.batches).toHaveLength(2);
  });
  it("não confunde notas com chaves ou séries diferentes", () => {
    expect(mesmaNota({ ...nota, chaveAcesso: "1".repeat(44) }, ["2".repeat(44), "001", nota.fornecedor, nota.cnpjFornecedor])).toBe(false);
    expect(mesmaNota(nota, ["", "001", nota.fornecedor, nota.cnpjFornecedor, "", "", "", "", "", "", "3"])).toBe(false);
  });
});
