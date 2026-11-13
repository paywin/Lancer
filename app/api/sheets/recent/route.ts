import { exigirUsuario } from "@/lib/auth";
import { rota } from "@/lib/api";
import { ultimosLancamentos } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export const GET = rota(async () => {
  await exigirUsuario();
  return { lancamentos: await ultimosLancamentos(10) };
});
