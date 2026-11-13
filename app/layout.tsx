import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/lib/auth";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <main className="mx-auto w-full max-w-3xl px-4 py-5"><QueueProvider key={session?.user?.email ?? "guest"} owner={session?.user?.email}>{children}</QueueProvider></main>
      </body>
    </html>
  );
}
