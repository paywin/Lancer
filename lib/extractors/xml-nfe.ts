import { XMLParser } from "fast-xml-parser";
import type { NotaExtraida } from "../schema";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false, // mantém tudo como string (nNF, chave e CNPJ não podem perder zeros)
  trimValues: true,
});

const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(",", "."));
  if (v == null || v === "" || !Number.isFinite(n) || n < 0) throw new Error("Valor numérico inválido no XML.");
  return n;
};

/**
 * Lê XML de NF-e (modelo 55) ou NFC-e (modelo 65), com ou sem envelope nfeProc.
 * Não usa IA: o XML já é estruturado e é a fonte mais confiável.
 */
export function parseNfeXml(xml: string): NotaExtraida {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new Error("Arquivo XML inválido.");
  }

  const nfe = doc?.nfeProc?.NFe ?? doc?.NFe ?? doc?.enviNFe?.NFe;
  if (Array.isArray(nfe) && nfe.length > 1) throw new Error("Envie um XML por nota; este arquivo contém várias NF-e.");
  const inf = (Array.isArray(nfe) ? nfe[0] : nfe)?.infNFe;
  if (!inf) throw new Error("O XML não parece ser uma NF-e/NFC-e (infNFe não encontrado).");

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};

  const chaveId = String(inf["@Id"] ?? "").replace(/^NFe/, "");
  const chaveProt = String(doc?.nfeProc?.protNFe?.infProt?.chNFe ?? "");
  const chave = [chaveProt, chaveId].find((c) => /^\d{44}$/.test(c)) ?? null;

  const dataRaw = String(ide.dhEmi ?? ide.dEmi ?? "");
  const dataEmissao = dataRaw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEmissao)) throw new Error("Data de emissão não encontrada no XML.");

  const itens = asArray<any>(inf.det).map((det) => {
    const p = det.prod ?? {};
    return {
      produto: String(p.xProd ?? "").trim(),
      quantidade: num(p.qCom),
      unidade: String(p.uCom ?? "UN").trim().toUpperCase(),
      precoUnit: num(p.vUnCom),
      total: Math.round((num(p.vProd) - num(p.vDesc ?? 0)) * 100) / 100,
      ...(p.vDesc != null ? { desconto: num(p.vDesc) } : {}),
    };
  });

  return {
    chaveAcesso: chave,
    numeroNf: String(ide.nNF ?? "").trim(),
    serie: String(ide.serie ?? "") || null,
    fornecedor: String(emit.xNome ?? emit.xFant ?? "").trim(),
    cnpjFornecedor: String(emit.CNPJ ?? emit.CPF ?? "") || null,
    dataEmissao,
    itens,
    valorTotalNota: inf.total?.ICMSTot?.vNF != null ? num(inf.total.ICMSTot.vNF) : null,
    origem: "xml",
  };
}
