import { exigirUsuario, HttpError } from "@/lib/auth";
import { rota } from "@/lib/api";
import { parseNfeXml } from "@/lib/extractors/xml-nfe";
import { respostaExtracao } from "@/lib/extract-response";

export const POST = rota(async (req) => {
  await exigirUsuario();
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) throw new HttpError(400, "Envie o arquivo XML no campo 'arquivo'.");
  if (arquivo.size > 2_000_000) throw new HttpError(413, "XML muito grande (máx. 2 MB).");
  try {
    return await respostaExtracao(parseNfeXml(await arquivo.text()));
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
});
