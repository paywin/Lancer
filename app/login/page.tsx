import { signIn, sessaoAtual } from "@/lib/auth";
import { redirect } from "next/navigation";
import { autenticacaoObrigatoria } from "@/lib/access";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!autenticacaoObrigatoria()) redirect("/");
  if ((await sessaoAtual())?.user?.email) redirect("/");
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-20 max-w-sm text-center">
      <img src="/icon.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
      <h1 className="text-2xl font-semibold">LançaNota</h1>
      <p className="mt-1 text-muted">Lance suas notas de compra direto na planilha.</p>
      <p className="mt-3 text-sm text-muted">Use qualquer conta Google. Seu acesso fica salvo neste navegador por até 90 dias.</p>
      {error && (
        <p className="mt-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error === "AccessDenied" ? "Entre com uma conta Google com e-mail verificado." : "Não foi possível entrar. Tente novamente."}
        </p>
      )}
      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button className="btn-primary w-full">Entrar com Google</button>
      </form>
    </div>
  );
}
