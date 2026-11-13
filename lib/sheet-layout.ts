import type { sheets_v4 } from "googleapis";

export const normalizarCabecalho = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function colunas(cabecalho: unknown[], esperados: readonly string[]) {
  const nomes = cabecalho.map((s) => normalizarCabecalho(String(s ?? "")));
  return esperados.map((nome) => {
    const normal = normalizarCabecalho(nome);
    const indices = nomes.flatMap((s, i) => s === normal ? [i] : []);
    if (indices.length !== 1) throw new Error(`Cabeçalho "${nome}" ausente ou repetido. Confira a primeira linha da aba configurada.`);
    return indices[0];
  });
}

export function celulas(linha: (string | number)[], indices: number[]): sheets_v4.Schema$RowData {
  const values: sheets_v4.Schema$CellData[] = Array.from({ length: Math.max(...indices) + 1 }, () => ({}));
  linha.forEach((value, i) => {
    values[indices[i]] = { userEnteredValue: typeof value === "number" ? { numberValue: value } : { stringValue: value } };
  });
  return { values };
}

export const canonico = (linha: unknown[], indices: number[]) => indices.map((i) => linha[i] ?? "");
