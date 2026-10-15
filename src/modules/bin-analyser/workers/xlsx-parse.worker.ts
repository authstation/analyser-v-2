import { parentPort, workerData } from "node:worker_threads";
import * as xlsx from "xlsx";

/**
 * Why: §3.2 — see the return-data counterpart. Reading + mapping a BIN master
 *      workbook is CPU-bound; offloading it to a worker thread keeps the HTTP
 *      event loop responsive while large imports run.
 * When: The BIN `parse` handler offloads to this module via `parseBinWorkbook`.
 * Where: src/modules/bin-analyser/workers/xlsx-parse.worker.ts.
 * How: Reproduces the exact previous inline parsing semantics (no datetime
 *      offset, trimmed + de-duplicated combined values, snake+camel aliases).
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

export function runBinParse(input: ParseInput): ParseOk | ParseErr {
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
        const cleanCell = cell.replace(/\r?\n|\r/g, " ").trim().toLowerCase();
        if (mappingValues.includes(cleanCell)) matches++;
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
          const dObj = rowArrDates[j] as Date;
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
    const mappedRow: any = {};
    let hasValidData = false;
    if (dbMappings.length > 0) {
      dbMappings.forEach((mapping) => {
        const targetHeaders = mapping.excelHeader.split(",").map((s: string) => s.trim().toLowerCase());
        const combinedValues: string[] = [];
        targetHeaders.forEach((th: string) => {
          const rowKey = Object.keys(row).find((k) => k.trim().toLowerCase() === th);
          if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== "") {
            const valStr = String(row[rowKey]).trim();
            if (!combinedValues.includes(valStr)) {
              combinedValues.push(valStr);
            }
          }
        });
        if (combinedValues.length > 0) {
          const val = combinedValues.join(", ");
          mappedRow[mapping.dbColumn] = val;

          // Map both snake_case and camelCase keys for UI and backend saving compatibility
          if (mapping.dbColumn === "bin_issue_date" || mapping.dbColumn === "binIssueDate") {
            mappedRow.bin_issue_date = val;
            mappedRow.binIssueDate = val;
          }
          if (mapping.dbColumn === "division") mappedRow.division = val;
          if (mapping.dbColumn === "circle") mappedRow.circle = val;
          if (mapping.dbColumn === "bin") mappedRow.bin = val;
          if (mapping.dbColumn === "entity_name" || mapping.dbColumn === "entityName") {
            mappedRow.entity_name = val;
            mappedRow.entityName = val;
          }
          if (mapping.dbColumn === "address") mappedRow.address = val;
          if (mapping.dbColumn === "police_station" || mapping.dbColumn === "policeStation") {
            mappedRow.police_station = val;
            mappedRow.policeStation = val;
          }
          if (mapping.dbColumn === "mobile") mappedRow.mobile = val;
          if (mapping.dbColumn === "email") mappedRow.email = val;
          if (mapping.dbColumn === "hq_address" || mapping.dbColumn === "hqAddress") {
            mappedRow.hq_address = val;
            mappedRow.hqAddress = val;
          }
          if (mapping.dbColumn === "forced_registration" || mapping.dbColumn === "forcedRegistration") {
            mappedRow.forced_registration = val;
            mappedRow.forcedRegistration = val;
          }
          if (mapping.dbColumn === "major_area" || mapping.dbColumn === "majorAreaOfEconomicActivity") {
            mappedRow.major_area = val;
            mappedRow.majorAreaOfEconomicActivity = val;
          }
          if (mapping.dbColumn === "manufacturing_area" || mapping.dbColumn === "areasOfManufacturing") {
            mappedRow.manufacturing_area = val;
            mappedRow.areasOfManufacturing = val;
          }
          if (mapping.dbColumn === "service_area" || mapping.dbColumn === "areasOfService") {
            mappedRow.service_area = val;
            mappedRow.areasOfService = val;
          }
          if (mapping.dbColumn === "bin_status" || mapping.dbColumn === "binStatus") {
            mappedRow.bin_status = val;
            mappedRow.binStatus = val;
          }
          if (mapping.dbColumn === "e_tin" || mapping.dbColumn === "eTin") {
            mappedRow.e_tin = val;
            mappedRow.eTin = val;
          }

          hasValidData = true;
        }
      });
    } else {
      hasValidData = true;
    }
    if (!hasValidData) continue;
    mappedRow.rawJson = JSON.stringify(row);
    mappedRow.tempId = Math.random().toString(36).substr(2, 9);
    processedData.push(mappedRow);
  }

  return { ok: true, data: processedData };
}

// Only act when actually running as a worker thread (keeps `runBinParse`
// importable by tests / callers in the main thread).
if (parentPort) {
  try {
    parentPort.postMessage(runBinParse(workerData as ParseInput));
  } catch (error: any) {
    parentPort.postMessage({ ok: false, code: "PARSE_ERROR", message: error?.message || String(error) });
  }
}
