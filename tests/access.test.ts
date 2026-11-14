import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";
const mocked = vi.hoisted(() => ({ session: vi.fn(), config: null as NextAuthConfig | null }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  mocked.config = config;
  return { auth: mocked.session, handlers: {}, signIn: vi.fn(), signOut: vi.fn() };
} }));
import { exigirUsuario, sessaoAtual } from "@/lib/auth";
import { autenticacaoObrigatoria } from "@/lib/access";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Google para qualquer conta", () => {
  it("exige login por padrão, inclusive sem configuração", async () => {
    vi.stubEnv("AUTH_REQUIRED", ""); mocked.session.mockResolvedValue(null);
    expect(autenticacaoObrigatoria()).toBe(true);
    await expect(exigirUsuario()).rejects.toMatchObject({ status: 401 });
  });
  it("aceita e-mail autenticado mesmo fora de uma lista antiga", async () => {
    vi.stubEnv("AUTH_REQUIRED", "true"); vi.stubEnv("ALLOWED_EMAILS", "antigo@example.com");
    for (const email of ["novo@gmail.com", "compras@example.com"]) {
      mocked.session.mockResolvedValue({ user: { email } });
      await expect(exigirUsuario()).resolves.toBe(email);
    }
  });
  it("usa a sessão existente sem um novo login", async () => {
    vi.stubEnv("AUTH_REQUIRED", "true");
    const session = { user: { email: "novo@gmail.com" } };
    mocked.session.mockResolvedValue(session);
    await expect(sessaoAtual()).resolves.toEqual(session);
    expect(mocked.config?.session).toMatchObject({ strategy: "jwt", maxAge: 90 * 24 * 60 * 60 });
    // Use Auth.js's HttpOnly persistent cookies rather than overriding browser storage.
    expect(mocked.config?.cookies?.sessionToken).toBeUndefined();
  });
  it("aceita somente identidades Google com e-mail verificado", async () => {
    const signIn = mocked.config!.callbacks!.signIn!;
    const valid = { user: { id: "1", email: "novo@gmail.com" }, account: { provider: "google", providerAccountId: "1", type: "oidc" as const }, profile: { email_verified: true } };
    expect(await signIn(valid)).toBe(true);
    expect(await signIn({ ...valid, profile: { email_verified: false } })).toBe(false);
    expect(await signIn({ ...valid, account: { ...valid.account, provider: "other" } })).toBe(false);
    expect(await signIn({ ...valid, user: { id: "1", email: "" } })).toBe(false);
  });
  it("mantém modo local sem login apenas quando explicitamente escolhido", async () => {
    vi.stubEnv("AUTH_REQUIRED", "false");
    await expect(exigirUsuario()).resolves.toBe("acesso-livre");
    await expect(sessaoAtual()).resolves.toBeNull();
    expect(mocked.session).not.toHaveBeenCalled();
  });
});
