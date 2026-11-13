import type { Metadata, Viewport } from "next";
import "./globals.css";
import { sessaoAtual } from "@/lib/auth";
import { autenticacaoObrigatoria, USUARIO_PUBLICO } from "@/lib/access";
import { QueueProvider } from "@/components/QueueProvider";

export const metadata: Metadata = {
  title: "LançaNota",
  description: "Lance notas de compra no Google Sheets com foto, QR Code ou XML",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "LançaNota", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await sessaoAtual();
  const owner = autenticacaoObrigatoria() ? session?.user?.email : USUARIO_PUBLICO;
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <main className="mx-auto w-full max-w-3xl px-4 py-5"><QueueProvider key={owner ?? "guest"} owner={owner}>{children}</QueueProvider></main>
      </body>
    </html>
  );
}
