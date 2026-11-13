import { z } from "zod";
import { exigirUsuario } from "@/lib/auth";
import { rota } from "@/lib/api";
import { NotaSchema } from "@/lib/schema";
import { lancarNota } from "@/lib/sheets";

const Body = z.object({ nota: NotaSchema, requestId: z.string().uuid(), forcar: z.boolean().optional() });

export const POST = rota(async (req) => {
  const usuario = await exigirUsuario();
  const { nota, requestId, forcar } = Body.parse(await req.json());
  return lancarNota(nota, usuario, requestId, forcar);
});
