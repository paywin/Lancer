"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/BackLink";
import { ErrorBox } from "@/components/ErrorBox";
import { useFila } from "@/components/QueueProvider";

export default function XmlPage() {
  const { fila } = useFila();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionados, setAdicionados] = useState(0);
  async function enviar(files: FileList | null) {
    if (!files?.length || !fila) return;
    setSalvando(true); setErro(null); setAdicionados(0);
    const erros: string[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.size > 2_000_000) throw new Error("máximo de 2 MB por XML");
        await fila.add(file.name, { tipo: "xml", xml: await file.text() });
        setAdicionados((n) => n + 1);
      } catch (e) { erros.push(`${file.name}: ${(e as Error).message}`); }
    }
    setErro(erros.length ? erros.join("\n") : null); setSalvando(false);
  }
  return <div className="space-y-4"><PageHeader titulo="Arquivo XML" />
    <label className="card flex cursor-pointer flex-col items-center gap-2 border-dashed py-10 text-center">
      <span className="text-3xl">📄</span><span>{salvando ? "Adicionando à fila…" : "Escolher XML(s)"}</span>
      <span className="text-sm text-muted">Uma nota por arquivo. Os arquivos serão processados em sequência.</span>
      <input type="file" accept=".xml,text/xml,application/xml" multiple hidden disabled={!fila || salvando} onChange={(e) => { void enviar(e.target.files); e.target.value = ""; }} />
    </label>
    <ErrorBox msg={erro} />
    {adicionados > 0 && <p role="status" className="text-primary">{adicionados} arquivo(s) adicionado(s) à fila.</p>}
    <Link className="btn-primary w-full" href="/fila">Ver fila e revisar</Link>
  </div>;
}
