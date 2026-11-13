import { afterEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("next-auth", () => ({ default: () => ({ auth: session, handlers: {}, signIn: vi.fn(), signOut: vi.fn() }) }));
import { exigirUsuario, sessaoAtual } from "@/lib/auth";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("modo de acesso", () => {
  it("abre sem sessão ou credenciais Google por padrão", async () => {
    vi.stubEnv("AUTH_REQUIRED", "");
    await expect(exigirUsuario()).resolves.toBe("acesso-livre");
    await expect(sessaoAtual()).resolves.toBeNull();
    expect(session).not.toHaveBeenCalled();
  });
  it("ignora sessão antiga no modo público", async () => {
    vi.stubEnv("AUTH_REQUIRED", "false");
    session.mockResolvedValue({ user: { email: "antigo@example.com" } });
    await expect(exigirUsuario()).resolves.toBe("acesso-livre");
    expect(session).not.toHaveBeenCalled();
  });
  it("restaura a exigência de sessão quando ativado", async () => {
    vi.stubEnv("AUTH_REQUIRED", "true"); session.mockResolvedValue(null);
    await expect(exigirUsuario()).rejects.toMatchObject({ status: 401 });
  });
  it("restaura a lista de e-mails autorizados", async () => {
    vi.stubEnv("AUTH_REQUIRED", "true"); vi.stubEnv("ALLOWED_EMAILS", "equipe@example.com");
    session.mockResolvedValue({ user: { email: "outro@example.com" } });
    await expect(exigirUsuario()).rejects.toMatchObject({ status: 401 });
    session.mockResolvedValue({ user: { email: "equipe@example.com" } });
    await expect(exigirUsuario()).resolves.toBe("equipe@example.com");
  });
});
