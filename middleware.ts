import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { auth } from "@/lib/auth";
import { autenticacaoObrigatoria } from "@/lib/access";
import type { NextAuthRequest } from "next-auth";

const protegido = auth((_req: NextAuthRequest, _event: NextFetchEvent) => NextResponse.next());
export function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!autenticacaoObrigatoria()) return NextResponse.next();
  return protegido(req, event);
}

// Protege as páginas. As rotas /api verificam a sessão por conta própria (respondem 401 em JSON).
export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
