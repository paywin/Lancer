import { z } from "zod";
import { exigirUsuario, HttpError } from "@/lib/auth";
import { rota } from "@/lib/api";
import { extrairDeQrCode } from "@/lib/extractors/qrcode-nfce";
import { respostaExtracao } from "@/lib/extract-response";

export const maxDuration = 60;

const Body = z.object({ conteudo: z.string().min(10, "QR Code vazio").max(2000) });

export const POST = rota(async (req) => {
  await exigirUsuario();
  const { conteudo } = Body.parse(await req.json());
  try {
    return await respostaExtracao(await extrairDeQrCode(conteudo));
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
});
