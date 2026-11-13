import { createHash } from "node:crypto";
import { google, type sheets_v4 } from "googleapis";
import { CONTROL_HEADER, SHEET_HEADER, type NotaExtraida } from "./schema";
import { mapToRows } from "./mapToRows";
import { canonico, celulas, colunas } from "./sheet-layout";
import { HttpError } from "./auth";

const spreadsheetId = () => {
  if (!process.env.SPREADSHEET_ID) throw new Error("SPREADSHEET_ID não configurado.");
  return process.env.SPREADSHEET_ID;
};
const sheetName = () => process.env.SHEET_NAME || "lancaNota";
const controlName = () => process.env.CONTROL_SHEET_NAME || "_controle";
const range = (name: string, r: string) => `'${name.replace(/'/g, "''")}'!${r}`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
let cached: sheets_v4.Sheets | undefined;
function client() {
  return cached ??= google.sheets({ version: "v4", auth: new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }) });
}

async function metadata() {
  return (await client().spreadsheets.get({ spreadsheetId: spreadsheetId(), fields: "sheets.properties,namedRanges" })).data;
}

async function contexto() {
  if (sheetName() === controlName()) throw new Error("As abas de produtos e de controle precisam ser diferentes.");
  const meta = await metadata();
  const data = meta.sheets?.find((s) => s.properties?.title === sheetName())?.properties;
  const control = meta.sheets?.find((s) => s.properties?.title === controlName())?.properties;
  if (data?.sheetId == null || control?.sheetId == null) throw new Error(`Configure as abas "${sheetName()}" e "${controlName()}" com os cabeçalhos do README. Nenhuma aba alternativa será criada.`);
  const response = await client().spreadsheets.values.batchGet({ spreadsheetId: spreadsheetId(),
    ranges: [range(sheetName(), "A1:Z1"), range(controlName(), "A1:Z1")],
  });
  const headers = response.data.valueRanges ?? [];
  return { dataId: data.sheetId, controlId: control.sheetId,
    dataColumns: colunas(headers[0]?.values?.[0] ?? [], SHEET_HEADER),
    controlColumns: colunas(headers[1]?.values?.[0] ?? [], CONTROL_HEADER),
    markers: meta.namedRanges ?? [],
  };
}

async function controles(ctx: Awaited<ReturnType<typeof contexto>>) {
  const res = await client().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: range(controlName(), "A2:Z"),
    valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
  return (res.data.values ?? []).map((r) => canonico(r, ctx.controlColumns));
}

type Identidade = Pick<NotaExtraida, "chaveAcesso" | "numeroNf" | "fornecedor" | "cnpjFornecedor" | "serie">;
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[^\w]/g, "").toLowerCase();
const nf = (s: unknown) => String(s ?? "").replace(/^0+(?=\d)/, "").trim();
export function mesmaNota(nota: Identidade, row: unknown[]) {
  if (nota.chaveAcesso && row[0]) return nota.chaveAcesso === row[0];
  if (!nf(nota.numeroNf) || nf(row[1]) !== nf(nota.numeroNf)) return false;
  if (nota.serie && row[10] && nf(nota.serie) !== nf(row[10])) return false;
  return nota.cnpjFornecedor && row[3] ? norm(nota.cnpjFornecedor) === norm(row[3]) : norm(nota.fornecedor) === norm(row[2]);
}

export async function notaJaLancada(nota: Identidade) {
  const rows = await controles(await contexto());
  const row = rows.find((r) => mesmaNota(nota, r));
  return row ? { lancadoPor: String(row[8]), lancadoEm: String(row[9]) } : null;
}

/** Both tables and durable uniqueness markers are committed in one atomic batch.
 * Explicit namedRangeId collisions abort the entire batch. Keep LN_* named ranges.
 * https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#AddNamedRangeRequest
 */
export async function lancarNota(nota: NotaExtraida, usuario: string, requestId: string, forcar = false) {
  const ctx = await contexto();
  const requestMarker = `ln_req_${hash(`${usuario}:${requestId}`)}`;
  const fingerprint = hash(JSON.stringify(nota));
  const requestName = `${requestMarker}_${fingerprint}`;
  const result = { linhas: nota.itens.length };
  const checkRequest = (markers: sheets_v4.Schema$NamedRange[]) => {
    const existing = markers.find((r) => r.namedRangeId === requestMarker);
    if (existing && existing.name !== requestName) throw new HttpError(409, "Este envio já foi registrado com outros dados. Atualize a fila antes de continuar.");
    return !!existing;
  };
  if (checkRequest(ctx.markers)) return result;
  if (!forcar && (await controles(ctx)).some((r) => mesmaNota(nota, r))) throw new HttpError(409, "Esta nota já foi lançada. Confira o histórico antes de lançar novamente.");
  const identity = nota.chaveAcesso || JSON.stringify([norm(nota.cnpjFornecedor || nota.fornecedor), nf(nota.numeroNf), nf(nota.serie)]);
  const noteMarker = `ln_note_${hash(identity)}`;
  const marker = (id: string, name = id): sheets_v4.Schema$Request => ({ addNamedRange: { namedRange: {
    namedRangeId: id, name, range: { sheetId: ctx.controlId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
  } } });
  const requests: sheets_v4.Schema$Request[] = [marker(requestMarker, requestName)];
  if (!forcar) requests.push(marker(noteMarker));
  const controlRow = [nota.chaveAcesso ?? "", nota.numeroNf, nota.fornecedor, nota.cnpjFornecedor ?? "", nota.dataEmissao,
    nota.itens.length, nota.valorTotalNota ?? nota.itens.reduce((s, i) => s + i.total, 0), nota.origem, usuario,
    new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), nota.serie ?? "", requestId];
  requests.push(
    { appendCells: { sheetId: ctx.dataId, rows: mapToRows(nota).map((r) => celulas(r, ctx.dataColumns)), fields: "userEnteredValue" } },
    { appendCells: { sheetId: ctx.controlId, rows: [celulas(controlRow, ctx.controlColumns)], fields: "userEnteredValue" } },
  );
  try {
    await client().spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId(), requestBody: { requests } });
  } catch (e) {
    const markers = (await metadata()).namedRanges ?? [];
    if (checkRequest(markers)) return result;
    if (!forcar && markers.some((r) => r.namedRangeId === noteMarker)) throw new HttpError(409, "Esta nota foi lançada por outro envio. Confira o histórico.");
    throw e;
  }
  return result;
}

export async function ultimosLancamentos(limite = 10) {
  return (await controles(await contexto())).slice(-limite).reverse().map((r) => ({
    nf: String(r[1]), fornecedor: String(r[2]), data: String(r[4]), itens: Number(r[5]), total: Number(r[6]),
    origem: String(r[7]), lancadoPor: String(r[8]), lancadoEm: String(r[9]),
  }));
}
