import * as cheerio from "cheerio";
import type { NotaExtraida } from "../../schema";

const brNum = (s: string): number => {
  const limpo = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Layout de consulta NFC-e usado pela maioria das SEFAZ (RS/SVRS, PR, BA, SP, GO, PE, ...):
 * tabela #tabResult com .txtTit, .Rqtd, .RUN, .RvlUnit e .valor.
 * Retorna null se a página não estiver nesse layout.
 */
export function parsePortalPadrao(html: string, chave: string | null): NotaExtraida | null {
  const $ = cheerio.load(html);
  const linhas = $("#tabResult tr");
  if (!linhas.length) return null;

  const itens = linhas
    .map((_, tr) => {
      const $tr = $(tr);
      const produto = $tr.find(".txtTit").first().text().trim();
      if (!produto) return null;
      const tirarRotulo = (sel: string) => $tr.find(sel).first().text().replace(/^[^:]*:/, "").trim();
      return {
        produto,
        quantidade: brNum(tirarRotulo(".Rqtd")),
        unidade: tirarRotulo(".RUN").toUpperCase() || "UN",
        precoUnit: brNum(tirarRotulo(".RvlUnit")),
        total: brNum($tr.find(".valor").first().text()),
      };
    })
    .get()
    .filter(Boolean) as NotaExtraida["itens"];

  if (!itens.length) return null;

  const fornecedor = $("#u20, .txtTopo").first().text().trim();
  const cnpj = ($("#conteudo .text").first().text().match(/[\d./-]{14,18}/)?.[0] ?? "").replace(/\D/g, "");

  const infos = $("#infos").text().replace(/\s+/g, " ");
  const numero = infos.match(/N[úu]mero:\s*(\d+)/i)?.[1] ?? "";
  const emissao = infos.match(/Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const dataEmissao = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : "";

  // "Valor a pagar R$" costuma ser o último .totalNumb; usa o maior valor como total da nota
  const totais = $("#totalNota .totalNumb")
    .map((_, el) => brNum($(el).text()))
    .get()
    .filter((n) => n > 0);

  return {
    chaveAcesso: chave,
    numeroNf: numero,
    fornecedor,
    cnpjFornecedor: cnpj || null,
    dataEmissao,
    itens,
    valorTotalNota: totais.length ? totais[totais.length - 1] : null,
    origem: "qrcode",
  };
}
