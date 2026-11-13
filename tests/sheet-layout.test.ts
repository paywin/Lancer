import { describe, it, expect } from "vitest";
import { celulas, colunas } from "@/lib/sheet-layout";
import { SHEET_HEADER, NotaSchema, dataValida } from "@/lib/schema";

describe("destino da planilha", () => {
  it("mapeia cabeçalhos reais, mesmo reordenados ou sem acento", () => {
    const header = ["Produto", "Total", "Mes", "Dia", "NF", "Fornecedor", "Quant", "U.M", "Preço Unit"];
    const indices = colunas(header, SHEET_HEADER);
    const row = celulas(["09", "12", "00123", "Fornecedor", "=1+1", 2, "UN", 4.5, 9], indices);
    expect(row.values?.[0].userEnteredValue).toEqual({ stringValue: "=1+1" });
    expect(row.values?.[1].userEnteredValue).toEqual({ numberValue: 9 });
    expect(row.values?.[2].userEnteredValue).toEqual({ stringValue: "09" });
    expect(row.values?.[4].userEnteredValue).toEqual({ stringValue: "00123" });
  });
  it("recusa aba com cabeçalhos ausentes ou repetidos", () => {
    expect(() => colunas(["Mes", "Dia"], SHEET_HEADER)).toThrow(/ausente/);
    expect(() => colunas([...SHEET_HEADER, "NF"], SHEET_HEADER)).toThrow(/repetido/);
  });
  it("valida datas reais e quantidade positiva", () => {
    expect(dataValida("2026-02-31")).toBe(false);
    expect(dataValida("2024-02-29")).toBe(true);
    expect(NotaSchema.safeParse({ numeroNf: " ", fornecedor: " ", dataEmissao: "2026-11-12", origem: "xml", itens: [] }).success).toBe(false);
  });
});
