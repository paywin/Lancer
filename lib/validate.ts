import type { NotaExtraida } from "./schema";
import { dataValida } from "./schema";

export type Alerta = { tipo: "erro" | "aviso"; mensagem: string; itemIndex?: number };

const TOLERANCIA = 0.05; // R$ 0,05 de diferença por arredondamento

/** Alertas exibidos na tela de revisão. Erros bloqueiam o lançamento; avisos não. */
export function validarNota(nota: NotaExtraida): Alerta[] {
  const alertas: Alerta[] = [];

  if (!nota.numeroNf?.trim()) alertas.push({ tipo: "erro", mensagem: "Número da NF não informado." });
  if (!nota.fornecedor?.trim()) alertas.push({ tipo: "erro", mensagem: "Fornecedor não informado." });
  if (!dataValida(nota.dataEmissao ?? ""))
    alertas.push({ tipo: "erro", mensagem: "Data de emissão inválida." });
  if (!nota.itens.length) alertas.push({ tipo: "erro", mensagem: "A nota não tem itens." });

  nota.itens.forEach((it, i) => {
    if (!it.produto?.trim())
      alertas.push({ tipo: "erro", mensagem: `Item ${i + 1}: produto vazio.`, itemIndex: i });
    if (!Number.isFinite(it.quantidade) || it.quantidade <= 0 || !Number.isFinite(it.precoUnit) || it.precoUnit < 0 || !Number.isFinite(it.total) || it.total < 0)
      alertas.push({ tipo: "erro", mensagem: `Item ${i + 1}: quantidade ou valor inválido.`, itemIndex: i });
    const calc = it.quantidade * it.precoUnit - (it.desconto ?? 0);
    // desconto por item faz o total ficar menor que quant × preço, por isso é só aviso
    if (Math.abs(calc - it.total) > Math.max(TOLERANCIA, it.total * 0.01))
      alertas.push({
        tipo: "aviso",
        mensagem: `Item ${i + 1}: quant × preço (${calc.toFixed(2)}) ≠ total (${it.total.toFixed(2)}).`,
        itemIndex: i,
      });
  });

  if (nota.valorTotalNota != null && nota.itens.length) {
    const soma = nota.itens.reduce((s, it) => s + it.total, 0);
    if (Math.abs(soma - nota.valorTotalNota) > TOLERANCIA)
      alertas.push({
        tipo: "aviso",
        mensagem: `Soma dos itens (R$ ${soma.toFixed(2)}) difere do total da nota (R$ ${nota.valorTotalNota.toFixed(2)}). Pode haver item faltando, desconto ou frete.`,
      });
  }

  return alertas;
}
