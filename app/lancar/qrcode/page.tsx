"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/BackLink";
import { ErrorBox } from "@/components/ErrorBox";
import { QrScanner } from "@/components/QrScanner";
import { useFila } from "@/components/QueueProvider";

export default function QrPage() {
  const { fila } = useFila();
  const [erro, setErro] = useState<string | null>(null);
  const [capturado, setCapturado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [manual, setManual] = useState("");
  const [sucesso, setSucesso] = useState("");
  async function consultar(conteudo: string) {
    setCapturado(true); setSalvando(true); setErro(null); setSucesso("");
    try {
      if (!fila) throw new Error("Aguarde a fila carregar.");
      await fila.add("QR Code da NFC-e", { tipo: "qrcode", conteudo: conteudo.trim() });
      setManual(""); setSucesso("QR adicionado à fila. Pode escanear a próxima nota.");
    } catch (e) { setErro((e as Error).message); }
    finally { setSalvando(false); }
  }
  return <div className="space-y-4"><PageHeader titulo="QR Code da NFC-e" />
    <p className="text-sm text-muted">Cada leitura entra na fila. A consulta à SEFAZ acontece em segundo plano, uma nota por vez.</p>
    {!capturado && fila && <QrScanner key={tentativa} onResult={consultar} />}
    {sucesso && <p role="status" className="card text-primary">{sucesso}</p>}
    <ErrorBox msg={erro} />
    {capturado && <button className="btn-primary w-full" disabled={salvando} onClick={() => { setCapturado(false); setTentativa((v) => v + 1); setErro(null); }}>{salvando ? "Salvando…" : "Escanear próxima nota"}</button>}
    <details className="card"><summary>Colar o link do QR manualmente</summary>
      <div className="mt-3 flex gap-2"><input aria-label="Link do QR Code" className="input" placeholder="https://...sefaz...?p=..." value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn-primary" disabled={!fila || salvando || manual.length < 10} onClick={() => consultar(manual)}>Adicionar</button></div>
    </details>
    <Link className="btn-ghost w-full" href="/fila">Ver fila e revisar</Link>
  </div>;
}
