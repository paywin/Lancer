import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { autenticacaoObrigatoria, DURACAO_SESSAO, USUARIO_PUBLICO } from "./access";

export const emailPermitido = (email?: string | null) => !!email?.trim();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login", error: "/login" },
  // Encrypted JWT in Auth.js's persistent HttpOnly cookie, never localStorage.
  session: { strategy: "jwt", maxAge: DURACAO_SESSAO },
  callbacks: {
    signIn: ({ user, account, profile }) => account?.provider === "google" && profile?.email_verified === true && emailPermitido(user.email),
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
