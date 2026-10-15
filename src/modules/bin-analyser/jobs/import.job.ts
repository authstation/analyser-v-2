import { eq } from "drizzle-orm";
import { db, storage } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { registerJobHandler } from "@/modules/jobs/services/job-runner.js";
import { BIN_IMPORT_JOB } from "@/modules/jobs/services/job-types.js";
import { invokeHandler, replayContext } from "@/modules/jobs/services/invoke-controller.js";
import { parse as binParse, save as binSave } from "@/modules/bin-analyser/controllers/bin-import.controller.js";

/**
 * Why: §3.1 — opt-in asynchronous BIN import. Reuses the live controller
 *      pipeline (worker-thread parse + COPY-based save) so behaviour cannot
 *      drift, while the HTTP request returns immediately.
 * When: `POST /api/bin-analyser/import-async` enqueues this job.
 * Where: src/modules/bin-analyser/jobs/import.job.ts.
 * How: Reads the stored upload from the tmp disk, replays `parse` then `save`
 *      through a minimal context, and records a structured result.
 */

export type BinImportJobPayload = {
  fileKey: string;
  fileName?: string;
  mimeType?: string;
  createdBy?: number | null;
};

async function handler(payload: BinImportJobPayload, ctx: { progress: (p: number, t?: number, m?: string) => Promise<void> }) {
  const tmp = storage.disk("tmp");
  let bytes: Buffer;
  try {
    bytes = await tmp.get(payload.fileKey);
  } catch {
    return { ok: false, stage: "read", error: "The uploaded file is no longer available for processing." };
  }

  try {
    await ctx.progress(5, undefined, "Reading workbook");

    const user = payload.createdBy ? await db.query.users.findFirst({ where: eq(users.id, payload.createdBy) }) : null;
    if (!user) {
      return { ok: false, stage: "auth", error: "The user who started this import no longer exists." };
    }

    const file = new File([bytes as any], payload.fileName || "import.xlsx", {
      type: payload.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const parseResult = await invokeHandler(binParse, replayContext({ file }));
    if (parseResult.status !== 200) {
      return { ok: false, stage: "parse", error: parseResult.body?.error || "Failed to parse the uploaded file." };
    }

    const rows: any[] = parseResult.body?.data || [];
    await ctx.progress(40, undefined, `Parsed ${rows.length} row(s)`);

    if (rows.length === 0) {
      return { ok: true, insertedRows: 0, parsedRows: 0, message: "No rows were parsed; nothing was saved." };
    }

    const saveResult = await invokeHandler(binSave, replayContext({ body: { data: rows }, auth: user }));
    if (saveResult.status !== 200) {
      return { ok: false, stage: "save", error: saveResult.body?.error || "Failed to save the parsed data." };
    }

    await ctx.progress(100, undefined, "Completed");
    return {
      ok: true,
      insertedRows: saveResult.body?.insertedRows ?? rows.length,
      skippedRowsWithoutBin: saveResult.body?.skippedRowsWithoutBin ?? 0,
      parsedRows: rows.length
    };
  } finally {
    await tmp.delete(payload.fileKey).catch(() => {});
  }
}

export function registerBinImportJob() {
  registerJobHandler(BIN_IMPORT_JOB, handler as any);
}
