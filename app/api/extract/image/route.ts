import { z } from "zod";
import { exigirUsuario, HttpError } from "@/lib/auth";
import { readLimited } from "@/lib/read-limited";
import { rota } from "@/lib/api";
import { extrairDeImagens } from "@/lib/extractors/image-openai";
import { respostaExtracao } from "@/lib/extract-response";

export const maxDuration = 60;

const Body = z.object({
  imagens: z
    .array(z.string().max(3_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "Imagem inválida"))
    .min(1, "Envie ao menos uma foto")
    .max(6, "Máximo de 6 fotos por nota"),
});

export const POST = rota(async (req) => {
  await exigirUsuario();
  let text: string;
  try { text = await readLimited(req.body, 3_500_000); }
  catch { throw new HttpError(413, "Fotos muito grandes. Reduza a quantidade ou resolução."); }
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new HttpError(400, "JSON inválido."); }
  const { imagens } = Body.parse(json);
  return respostaExtracao(await extrairDeImagens(imagens));
});
