import type { NotaExtraida } from "./schema";

/** "2026-11-10" → { mes: "11", dia: "10" } */
export function splitData(dataIso: string): { mes: string; dia: string } {
  const [, mes, dia] = dataIso.split("-");
  return { mes, dia };
}

/** Arredonda para evitar lixo de ponto flutuante (ex.: 0.30000000000000004). */
export function round(n: number, casas = 4): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

/** Uma linha por item: Mês | Dia | Nf | Fornecedor | Produto | Quant | U.M | Preço Unit | Total */
export function mapToRows(nota: NotaExtraida): (string | number)[][] {
  const { mes, dia } = splitData(nota.dataEmissao);
  return nota.itens.map((it) => [
    // The Sheets writer uses stringValue to preserve zeros without parsing formulas.
    mes,
    dia,
    nota.numeroNf,
    nota.fornecedor,
    it.produto,
    round(it.quantidade),
    it.unidade.toUpperCase(),
    round(it.precoUnit),
    round(it.total, 2),
  ]);
}
