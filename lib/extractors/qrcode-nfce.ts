import * as cheerio from "cheerio";
import type { NotaExtraida } from "../schema";
import { parsePortalPadrao } from "./sefaz/portal-padrao";
import { extrairDeTexto } from "./image-openai";
import { readLimited } from "../read-limited";

/** Extrai a chave de 44 dígitos do conteúdo do QR (parâmetro p=chave|versao|...). */
export function chaveDoQr(conteudo: string): string | null {
  try {
    const p = new URL(conteudo).searchParams.get("p") ?? "";
    const chave = p.split("|")[0]?.replace(/\D/g, "");
    if (chave?.length === 44) return chave;
  } catch {
    /* não é URL */
  }
  return conteudo.match(/\d{44}/)?.[0] ?? null;
}

/** Só permite consultar domínios governamentais (evita usar o servidor como proxy para qualquer site). */
export function urlPermitida(conteudo: string): URL {
  let url: URL;
  try {
    url = new URL(conteudo.trim());
  } catch {
    throw new Error("O QR Code não contém uma URL. Ele é de uma NFC-e (cupom fiscal)?");
  }
  if (!/^https?:$/.test(url.protocol) || !/\.gov\.br$/i.test(url.hostname) || url.username || url.password || url.port)
    throw new Error("O QR Code não aponta para um site da SEFAZ (.gov.br).");
  return url;
}

export async function extrairDeQrCode(conteudo: string): Promise<NotaExtraida> {
  let url = urlPermitida(conteudo);
  const chave = chaveDoQr(conteudo);

  let html: string;
  try {
    const signal = AbortSignal.timeout(20000);
    let resp: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects++) {
      resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "manual",
      signal,
    });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        await resp.body?.cancel();
        const location = resp.headers.get("location");
        if (!location || redirects === 3) throw new Error("Redirecionamento inválido ou excessivo.");
        url = urlPermitida(new URL(location, url).href);
      } else break;
    }
    if (!resp) throw new Error("Resposta vazia.");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await readLimited(resp.body, 2_000_000);
  } catch (e) {
    throw new Error(
      `Não consegui consultar a nota no site da SEFAZ (${(e as Error).message}). Tente de novo ou lance pela foto.`
    );
  }

  const padrao = parsePortalPadrao(html, chave);
  if (padrao && padrao.itens.length) return padrao;

  // Layout desconhecido: manda o texto visível da página para a IA.
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const texto = $("body").text().replace(/\s+/g, " ").trim();
  if (texto.length < 200 || /captcha/i.test(html))
    throw new Error("O site da SEFAZ pediu captcha ou não retornou os itens. Lance esta nota pela foto.");

  const nota = await extrairDeTexto(texto, "qrcode");
  return { ...nota, chaveAcesso: nota.chaveAcesso ?? chave };
}
