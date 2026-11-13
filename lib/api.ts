import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Envolve um handler de rota: converte exceções em JSON { error } com o status certo. */
export function rota<T>(fn: (req: Request) => Promise<T>) {
  return async (req: Request) => {
    try {
      return NextResponse.json(await fn(req));
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: e.issues.map((i) => i.message).join("; ") }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Não foi possível concluir a operação. Tente novamente; se continuar, confira a configuração e os registros do servidor." }, { status: 500 });
    }
  };
}
