import { Worker } from "node:worker_threads";

/**
 * Why: §3.2 — spawns the xlsx parsing worker so the HTTP event loop is never
 *      blocked by CPU-bound workbook parsing/mapping.
 * When: The return-data `parse` handler has a validated upload + resolved
 *       column mappings.
 * Where: src/modules/return-data-analyser/utils/parse-worker.ts.
 * How: One short-lived worker per import (imports are infrequent, so pooling is
 *      unnecessary); the result is settled exactly once and the thread is
 *      always terminated.
 */

export type ParseMapping = { dbColumn: string; excelHeader: string };

export type ParseWorkerInput = {
  /** Raw file bytes. */
  buffer: Uint8Array;
  /** Resolved column mappings (already defaulted by the caller). */
  mappings: ParseMapping[];
  /** Maximum allowed data rows (from settings). */
  maxRows: number;
};

export type ParseWorkerResult = { ok: true; data: any[] } | { ok: false; code: string; message?: string };

/**
 * Narrowing helper: with `strict: false` in this project, TypeScript does not
 * narrow a union on a boolean discriminant, so callers use this guard instead.
 */
export function isParseError(result: ParseWorkerResult): result is { ok: false; code: string; message?: string } {
  return result.ok === false;
}

export function parseReturnWorkbook(input: ParseWorkerInput): Promise<ParseWorkerResult> {
  return new Promise<ParseWorkerResult>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(new URL("../workers/xlsx-parse.worker.ts", import.meta.url), { workerData: input });

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
      void worker.terminate();
    };

    worker.once("message", (message) => finish(() => resolve(message as ParseWorkerResult)));
    worker.once("error", (error) => finish(() => reject(error)));
    worker.once("exit", (code) => {
      if (code !== 0) finish(() => reject(new Error(`xlsx parse worker exited with code ${code}`)));
    });
  });
}
