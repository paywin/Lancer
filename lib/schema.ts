import { z } from "zod";

export const ItemSchema = z.object({
  produto: z.string().trim().min(1, "Produto vazio").max(1000),
  quantidade: z.number().positive("Quantidade deve ser maior que zero"),
  unidade: z.string().default("UN"),
  precoUnit: z.number().nonnegative(),
  total: z.number().nonnegative(),
  desconto: z.number().nonnegative().optional(),
});

export const NotaSchema = z.object({
  chaveAcesso: z.string().regex(/^\d{44}$/).optional().nullable(),
  numeroNf: z.string().trim().min(1, "Número da NF vazio").max(100),
  serie: z.string().optional().nullable(),
  fornecedor: z.string().trim().min(1, "Fornecedor vazio").max(1000),
  cnpjFornecedor: z.string().optional().nullable(),
  dataEmissao: z.string().refine(dataValida, "Data de emissão inválida"),
  itens: z.array(ItemSchema).min(1, "Nenhum item").max(1000),
  valorTotalNota: z.number().nonnegative().optional().nullable(),
  origem: z.enum(["foto", "qrcode", "xml"]),
});

export function dataValida(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type Item = z.infer<typeof ItemSchema>;
export type NotaExtraida = z.infer<typeof NotaSchema>;

export const SHEET_HEADER = [
  "Mês",
  "Dia",
  "Nf",
  "Fornecedor",
  "Produto",
  "Quant",
  "U.M",
  "Preço Unit",
  "Total",
] as const;

export const CONTROL_HEADER = [
  "Chave",
  "Nf",
  "Fornecedor",
  "CNPJ",
  "Data Emissão",
  "Itens",
  "Valor Total",
  "Origem",
  "Lançado por",
  "Lançado em",
  "Série",
  "ID envio",
] as const;
