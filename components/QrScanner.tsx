"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

/** Abre a câmera traseira e chama onResult uma única vez com o conteúdo do QR. */
export function QrScanner({ onResult }: { onResult: (texto: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let lido = false;
    let cancelado = false;
    const reader = new BrowserQRCodeReader();
    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current!, (result, _err, ctrl) => {
        if (cancelado) { ctrl.stop(); return; }
        if (result && !lido) {
          lido = true;
          ctrl.stop();
          navigator.vibrate?.(80);
          cbRef.current(result.getText());
        }
      })
      .then((c) => { if (cancelado) c.stop(); else controls = c; })
      .catch(() => setErro("Não foi possível acessar a câmera. Permita o acesso à câmera nas configurações do navegador."));
    return () => { cancelado = true; controls?.stop(); };
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80" />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
