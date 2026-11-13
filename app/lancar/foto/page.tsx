"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { PageHeader } from "@/components/BackLink";
import { ErrorBox } from "@/components/ErrorBox";
import { useFila } from "@/components/QueueProvider";

const MAX_FOTOS = 6;

export default function FotoPage() {
  const router = useRouter();
  const { fila } = useFila();
  const [sucesso, setSucesso] = useState("");
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "comprimindo" | "lendo">("idle");
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(files: FileList | null) {
    if (!files?.length) return;
    setErro(null);
    setStatus("comprimindo");
    try {
      const novas: string[] = [];
      for (const f of Array.from(files).slice(0, MAX_FOTOS - fotos.length)) {
        // ~1 MB e 2000 px mantém o texto legível para a IA e cabe no limite de 4,5 MB da Vercel
        const comp = await imageCompression(f, { maxSizeMB: 0.4, maxWidthOrHeight: 2000, fileType: "image/jpeg", useWebWorker: true });
        novas.push(await imageCompression.getDataUrlFromFile(comp));
      }
      setFotos((a) => [...a, ...novas]);
    } catch {
      setErro("Não consegui processar a imagem.");
    } finally {
      setStatus("idle");
    }
  }

  async function enviar() {
    setErro(null);
    setStatus("lendo");
    try {
      if (!fila) throw new Error("Aguarde a fila carregar.");
      if (JSON.stringify({ imagens: fotos }).length > 3_500_000) throw new Error("As fotos ficaram muito grandes. Envie menos imagens ou reduza a resolução.");
      await fila.add(`Nota com ${fotos.length} foto(s)`, { tipo: "foto", imagens: fotos });
      setFotos([]);
      setSucesso("Nota adicionada à fila. Você já pode fotografar a próxima.");
      setStatus("idle");
    } catch (e) {
      setErro((e as Error).message);
      setStatus("idle");
    }
  }

  return (
    <div>
      <PageHeader titulo="Foto da nota" />
      <p className="mb-4 text-sm text-muted">
        Fotografe a nota inteira, reta e bem iluminada. Se o cupom for comprido, tire várias fotos em sequência (até {MAX_FOTOS}).
      </p>

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary" onClick={() => camRef.current?.click()} disabled={fotos.length >= MAX_FOTOS || status !== "idle"}>
          📷 Tirar foto
        </button>
        <button className="btn-ghost" onClick={() => galRef.current?.click()} disabled={fotos.length >= MAX_FOTOS || status !== "idle"}>
          🖼️ Galeria
        </button>
      </div>

      {fotos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {fotos.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt={`Foto ${i + 1}`} className="aspect-[3/4] w-full rounded-lg border border-border object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
              <button
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-white"
                onClick={() => setFotos((a) => a.filter((_, j) => j !== i))}
                aria-label="Remover foto"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <ErrorBox msg={erro} />
        {sucesso && <p role="status" className="text-sm text-primary">{sucesso}</p>}
        <button className="btn-primary w-full" onClick={enviar} disabled={!fila || !fotos.length || status !== "idle"}>
          {status === "lendo" ? "Salvando na fila…" : status === "comprimindo" ? "Preparando foto…" : `Adicionar à fila (${fotos.length} foto${fotos.length === 1 ? "" : "s"})`}
        </button>
        <button className="btn-ghost w-full" onClick={() => router.push("/fila")}>Ver fila e revisar</button>
      </div>
    </div>
  );
}
