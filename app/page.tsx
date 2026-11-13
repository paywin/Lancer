import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { RecentList } from "@/components/RecentList";

const opcoes = [
  { href: "/lancar/foto", titulo: "Foto da nota", desc: "Tire foto do cupom ou da DANFE. A IA lê os itens.", icone: "📷" },
  { href: "/lancar/qrcode", titulo: "QR Code", desc: "Leia o QR do cupom fiscal (NFC-e).", icone: "🔳" },
  { href: "/lancar/xml", titulo: "Arquivo XML", desc: "Envie um ou vários XMLs de NF-e.", icone: "📄" },
];

export default async function Home() {
  const session = await auth();
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">LançaNota</h1>
          <p className="text-sm text-muted">Olá, {session?.user?.name?.split(" ")[0] ?? "bem-vindo"}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="text-sm text-muted underline">Sair</button>
        </form>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {opcoes.map((o) => (
          <Link key={o.href} href={o.href} className="card flex items-center gap-4 transition hover:border-primary sm:flex-col sm:items-start">
            <span className="text-3xl" aria-hidden>{o.icone}</span>
            <span>
              <span className="block font-medium">{o.titulo}</span>
              <span className="block text-sm text-muted">{o.desc}</span>
            </span>
          </Link>
        ))}
      </section>

      <RecentList />
    </div>
  );
}
