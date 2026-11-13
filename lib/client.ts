"use client";
import type { NotaExtraida } from "./schema";
import type { Alerta } from "./validate";

export type Extracao = {
  nota: NotaExtraida;
  alertas: Alerta[];
  duplicada: { lancadoPor: string; lancadoEm: string } | null;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) {
    window.location.href = "/login";
  }
  if (!resp.ok) throw new ApiError(resp.status, data.error ?? `Erro ${resp.status}`);
  return data as T;
}

export const postJson = <T,>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

