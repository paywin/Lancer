import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseNfeXml } from "@/lib/extractors/xml-nfe";

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8");

describe("parseNfeXml", () => {
  it("lê NF-e com nfeProc e vários itens", () => {
    const n = parseNfeXml(fx("nfe-2itens.xml"));
    expect(n.numeroNf).toBe("1234");
    expect(n.fornecedor).toBe("DISTRIBUIDORA EXEMPLO LTDA");
    expect(n.cnpjFornecedor).toBe("12345678000199");
    expect(n.chaveAcesso).toBe("35261112345678000199550010000012341000012345");
    expect(n.dataEmissao).toBe("2026-11-05");
    expect(n.valorTotalNota).toBe(440);
    expect(n.itens).toEqual([
      { produto: "ARROZ TIPO 1 5KG", quantidade: 10, unidade: "UN", precoUnit: 24.9, total: 249 },
      { produto: "OLEO DE SOJA 900ML", quantidade: 2, unidade: "CX", precoUnit: 95.5, total: 191 },
    ]);
  });

  it("lê NFC-e sem envelope e com um único item", () => {
    const n = parseNfeXml(fx("nfce-1item.xml"));
    expect(n.itens).toHaveLength(1);
    expect(n.itens[0]).toMatchObject({ produto: "BANANA PRATA", quantidade: 1.235, unidade: "KG", total: 7.4 });
    expect(n.chaveAcesso).toBe("41261198765432000110650020000098761000098765");
  });

  it("rejeita XML que não é NF-e", () => {
    expect(() => parseNfeXml("<foo><bar/></foo>")).toThrow(/infNFe/);
  });
  it("desconta vDesc do item e preserva o total da nota", () => {
    const xml = fx("nfe-2itens.xml").replace("<vProd>249.00</vProd>", "<vProd>249.00</vProd><vDesc>9.00</vDesc>");
    const n = parseNfeXml(xml);
    expect(n.itens[0].total).toBe(240);
    expect(n.itens[0].desconto).toBe(9);
    expect(n.valorTotalNota).toBe(440);
  });
});
