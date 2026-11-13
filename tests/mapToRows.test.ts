import { describe, expect, it } from "vitest";
import { mapToRows, splitData } from "@/lib/mapToRows";
import { validarNota } from "@/lib/validate";
import type { NotaExtraida } from "@/lib/schema";

const nota: NotaExtraida = {
  numeroNf: "1234",
  fornecedor: "FORNECEDOR X",
  dataEmissao: "2026-03-07",
  origem: "xml",
  valorTotalNota: 10.3,
  itens: [
    { produto: "A", quantidade: 3, unidade: "un", precoUnit: 0.1, total: 0.3 },
    { produto: "B", quantidade: 1, unidade: "KG", precoUnit: 10, total: 10 },
  ],
};

describe("mapToRows", () => {
  it("gera uma linha por item nas 9 colunas", () => {
    const rows = mapToRows(nota);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["03", "07", "1234", "FORNECEDOR X", "A", 3, "UN", 0.1, 0.3]);
    rows.forEach((r) => expect(r).toHaveLength(9));
  });

  it("splitData", () => expect(splitData("2026-11-10")).toEqual({ mes: "11", dia: "10" }));
});

describe("validarNota", () => {
  it("nota consistente não tem alertas", () => expect(validarNota(nota)).toEqual([]));

  it("avisa quando a soma difere do total da nota", () => {
    const a = validarNota({ ...nota, valorTotalNota: 50 });
    expect(a.some((x) => x.tipo === "aviso" && /Soma/.test(x.mensagem))).toBe(true);
  });

  it("erro quando falta fornecedor", () => {
    expect(validarNota({ ...nota, fornecedor: "" }).some((x) => x.tipo === "erro")).toBe(true);
  });
});
