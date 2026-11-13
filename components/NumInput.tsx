"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");
const parse = (s: string) => {
  const t = s.trim();
  // aceita "1.234,56", "1234,56" e "1234.56"
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(norm);
  return t === "" ? 0 : Number.isFinite(n) ? n : NaN;
};

/** Campo numérico com vírgula decimal (teclado brasileiro). */
export function NumInput({ value, onChange, className = "" }: { value: number; onChange: (n: number) => void; className?: string }) {
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => {
    if (!Object.is(parse(txt), value)) setTxt(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={`input text-right tabular-nums ${className}`}
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = parse(e.target.value);
        onChange(n);
      }}
    />
  );
}
