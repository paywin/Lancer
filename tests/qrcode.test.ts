import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chaveDoQr, urlPermitida } from "@/lib/extractors/qrcode-nfce";
import { parsePortalPadrao } from "@/lib/extractors/sefaz/portal-padrao";
import { vi } from "vitest";
import { extrairDeQrCode } from "@/lib/extractors/qrcode-nfce";

const CHAVE = "41261111222333000181650010000456781000045678";

describe("QR Code NFC-e", () => {
  it("extrai a chave do parâmetro p", () => {
    expect(chaveDoQr(`https://www.fazenda.pr.gov.br/nfce/qrcode?p=${CHAVE}|2|1|1|ABCDEF`)).toBe(CHAVE);
  });

  it("bloqueia URLs fora de .gov.br", () => {
    expect(() => urlPermitida("https://example.com/?p=1")).toThrow();
    expect(() => urlPermitida("http://169.254.169.254/latest")).toThrow();
    expect(urlPermitida("https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=1").hostname).toBe("www.sefaz.rs.gov.br");
  });

  it("lê a página no layout padrão da SEFAZ", () => {
    const html = readFileSync(path.join(__dirname, "fixtures", "sefaz-portal-padrao.html"), "utf8");
    const n = parsePortalPadrao(html, CHAVE)!;
    expect(n.fornecedor).toBe("SUPERMERCADO MODELO LTDA");
    expect(n.cnpjFornecedor).toBe("11222333000181");
    expect(n.numeroNf).toBe("45678");
    expect(n.dataEmissao).toBe("2026-11-08");
    expect(n.valorTotalNota).toBe(54.29);
    expect(n.itens).toEqual([
      { produto: "LEITE INTEGRAL 1L", quantidade: 6, unidade: "UN", precoUnit: 4.79, total: 28.74 },
      { produto: "QUEIJO MUSSARELA", quantidade: 0.512, unidade: "KG", precoUnit: 49.9, total: 25.55 },
    ]);
  });

  it("retorna null para layout desconhecido", () => {
    expect(parsePortalPadrao("<html><body>outro</body></html>", null)).toBeNull();
  });
  it("bloqueia redirecionamento para fora de .gov.br antes da próxima requisição", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/internal" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(extrairDeQrCode("https://www.sefaz.rs.gov.br/teste")).rejects.toThrow(/SEFAZ/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
