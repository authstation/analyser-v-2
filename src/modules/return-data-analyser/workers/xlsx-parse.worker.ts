import { parentPort, workerData } from "node:worker_threads";
import * as xlsx from "xlsx";

/**
 * Why: §3.2 — reading + mapping a large workbook (`xlsx.read` +
 *      `sheet_to_json` + the O(rows × mappings) mapping loop) is CPU-bound and,
 *      on Bun/Node's single thread, it blocks every other in-flight request for
 *      the duration. Running it in a worker thread keeps the HTTP event loop
 *      responsive during imports.
 * When: The `parse` handler offloads to this module via `parseReturnWorkbook`.
 * Where: src/modules/return-data-analyser/workers/xlsx-parse.worker.ts.
 * How: The main thread passes the file bytes + already-resolved column mappings
 *      + the row cap; this module reproduces the exact previous parsing
 *      semantics and posts back either `{ ok: true, data }` or a typed error.
 *
 * NOTE: keep this logic byte-for-byte in sync with the previous inline parse.
 */

type Mapping = { dbColumn: string; excelHeader: string };

type ParseInput = {
  buffer: Uint8Array;
  mappings: Mapping[];
  maxRows: number;
};

type ParseOk = { ok: true; data: any[] };
type ParseErr = { ok: false; code: string; message?: string };

export function runReturnParse(input: ParseInput): ParseOk | ParseErr {
  const buffer = Buffer.from(input.buffer);
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { ok: false, code: "NO_SHEET" };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { ok: false, code: "NO_WORKSHEET" };

  const rawMatrix = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false });
  const rawMatrixDates = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: true });

  if (!rawMatrix || rawMatrix.length === 0) return { ok: false, code: "EMPTY" };
  if (rawMatrix.length > input.maxRows + 5) return { ok: false, code: "TOO_MANY_ROWS" };

  const dbMappings = input.mappings;
  const mappingValues = dbMappings.map((m) => (m.excelHeader || "").trim().toLowerCase()).filter(Boolean);

  let headerRowIndex = 0;
  let maxMatches = 0;
  for (let i = 0; i < Math.min(20, rawMatrix.length); i++) {
    const row = rawMatrix[i];
    if (!Array.isArray(row)) continue;
    let matches = 0;
    for (const cell of row) {
      if (typeof cell === "string") {
        if (mappingValues.includes(cell.replace(/\r?\n|\r/g, " ").trim().toLowerCase())) matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      headerRowIndex = i;
    }
  }
  if (maxMatches === 0) headerRowIndex = 0;

  const headers = rawMatrix[headerRowIndex] || [];
  let dataStartIndex = headerRowIndex + 1;
  if (dataStartIndex < rawMatrix.length) {
    const nextRow = rawMatrix[dataStartIndex];
    let parenthesisPatternCount = 0;
    if (Array.isArray(nextRow)) {
      for (const cell of nextRow) {
        if (typeof cell === "string" && /^\(\s*\d+\s*\)$/.test(cell.trim())) parenthesisPatternCount++;
        else if (typeof cell === "number" && cell < 0) parenthesisPatternCount++;
      }
    }
    if (parenthesisPatternCount >= 2) dataStartIndex++;
  }

  const rawData: any[] = [];
  for (let i = dataStartIndex; i < rawMatrix.length; i++) {
    const rowArr = rawMatrix[i];
    const rowArrDates = rawMatrixDates[i] || [];
    if (!Array.isArray(rowArr)) continue;
    if (rowArr.every((cell) => cell === null || cell === "")) continue;
    const rowObj: any = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header && typeof header === "string") {
        const cleanHeader = header.replace(/\r?\n|\r/g, " ").trim();
        let cellValue = rowArr[j];
        if (rowArrDates[j] instanceof Date && !isNaN(rowArrDates[j].getTime())) {
          const dObj = new Date(rowArrDates[j].getTime() + 4 * 60 * 60 * 1000);
          const yyyy = dObj.getFullYear();
          const mm = String(dObj.getMonth() + 1).padStart(2, "0");
          const dd = String(dObj.getDate()).padStart(2, "0");
          cellValue = `${yyyy}-${mm}-${dd}`;
        }
        rowObj[cleanHeader] = cellValue;
      }
    }
    rawData.push(rowObj);
  }

  const processedData: any[] = [];
  for (const row of rawData) {
    // Filter: Only include rows where return form is "Mushak-9.1: Value Added Tax Return"
    const formKey = Object.keys(row).find((k) => {
      const lower = k.trim().toLowerCase();
      return lower === "name of return form" || lower === "return form" || lower === "form name";
    });
    if (formKey) {
      const formVal = String(row[formKey] || "").trim();
      if (formVal !== "Mushak-9.1: Value Added Tax Return") {
        continue;
      }
    }

    const mappedRow: any = {};
    let hasValidData = false;
    if (dbMappings.length > 0) {
      dbMappings.forEach((mapping) => {
        const targetHeaders = mapping.excelHeader.split(",").map((s: string) => s.trim().toLowerCase());
        const combinedValues: string[] = [];
        targetHeaders.forEach((th: string) => {
          const rowKey = Object.keys(row).find((k) => k.trim().toLowerCase() === th);
          if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null) {
            combinedValues.push(String(row[rowKey]));
          }
        });
        if (combinedValues.length > 0) {
          mappedRow[mapping.dbColumn] = combinedValues.join(", ");
          hasValidData = true;
        }
      });
    } else {
      hasValidData = true;
    }
    if (!hasValidData) continue;

    const rawBin = mappedRow.bin ? String(mappedRow.bin).trim() : "";
    const rawSub = mappedRow.submission_id ? String(mappedRow.submission_id).trim() : "";
    const rawPeriod = mappedRow.tax_period ? String(mappedRow.tax_period).trim() : "";

    if (!rawBin && !rawSub && !rawPeriod) {
      continue;
    }

    if (
      rawBin.toLowerCase() === "total" ||
      rawBin.toLowerCase() === "grand total" ||
      rawSub.toLowerCase() === "total" ||
      rawSub.toLowerCase() === "grand total"
    ) {
      continue;
    }

    mappedRow.rawJson = JSON.stringify(row);
    mappedRow.tempId = Math.random().toString(36).substring(2, 11);
    processedData.push(mappedRow);
  }

  return { ok: true, data: processedData };
}

// Only act when actually running as a worker thread (keeps `runReturnParse`
// importable by tests / callers in the main thread).
if (parentPort) {
  try {
    parentPort.postMessage(runReturnParse(workerData as ParseInput));
  } catch (error: any) {
    parentPort.postMessage({ ok: false, code: "PARSE_ERROR", message: error?.message || String(error) });
  }
}
