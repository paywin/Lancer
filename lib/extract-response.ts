import type { NotaExtraida } from "./schema";
import { notaJaLancada } from "./sheets";
import { validarNota } from "./validate";

/** Resposta padrão das rotas /api/extract/*: a nota + alertas + aviso de duplicidade. */
export async function respostaExtracao(nota: NotaExtraida) {
  let duplicada = null;
  try {
    duplicada = await notaJaLancada(nota);
  } catch (e) {
    console.warn("Não foi possível checar duplicidade:", (e as Error).message);
  }
  return { nota, alertas: validarNota(nota), duplicada };
}
