export { auth as middleware } from "@/lib/auth";

// Protege as páginas. As rotas /api verificam a sessão por conta própria (respondem 401 em JSON).
export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
