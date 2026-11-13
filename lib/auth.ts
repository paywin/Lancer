import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { autenticacaoObrigatoria, USUARIO_PUBLICO } from "./access";

const permitidos = () =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const emailPermitido = (email?: string | null) => !!email && permitidos().includes(email.toLowerCase());

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // só e-mails da lista ALLOWED_EMAILS conseguem entrar
    signIn: ({ user }) => emailPermitido(user.email),
    authorized: ({ auth }) => emailPermitido(auth?.user?.email),
  },
});

/** Para as rotas de API: retorna o e-mail do usuário ou lança 401. */
export async function exigirUsuario(): Promise<string> {
  if (!autenticacaoObrigatoria()) return USUARIO_PUBLICO;
  const session = await auth();
  const email = session?.user?.email;
  if (!emailPermitido(email)) throw new HttpError(401, "Não autorizado. Faça login.");
  return email!;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function sessaoAtual() {
  return autenticacaoObrigatoria() ? auth() : null;
}
