import { eq } from "drizzle-orm";
import { db, storage } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { registerJobHandler } from "@/modules/jobs/services/job-runner.js";
import { RETURN_IMPORT_JOB } from "@/modules/jobs/services/job-types.js";
import { invokeHandler, replayContext } from "@/modules/jobs/services/invoke-controller.js";
import { parse as returnParse, save as returnSave } from "@/modules/return-data-analyser/controllers/return-import.controller.js";

/**
 * Why: §3.1 — opt-in asynchronous Return import. Reuses the live controller
 *      pipeline (worker-thread parse + COPY-based save) so behaviour cannot
 *      drift, while the HTTP request returns immediately.
 * When: `POST /api/return-data/import-async` enqueues this job.
 * Where: src/modules/return-data-analyser/jobs/import.job.ts.
 * How: Reads the stored upload from the tmp disk, replays `parse` then `save`
 *      through a minimal context, and records a structured result.
 */

export type ReturnImportJobPayload = {
  fileKey: string;
  fileName?: string;
  mimeType?: string;
  createdBy?: number | null;
};

async function handler(payload: ReturnImportJobPayload, ctx: { progress: (p: number, t?: number, m?: string) => Promise<void> }) {
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

    const parseResult = await invokeHandler(returnParse, replayContext({ file }));
    if (parseResult.status !== 200) {
      return { ok: false, stage: "parse", error: parseResult.body?.error || "Failed to parse the uploaded file." };
    }

    const rows: any[] = parseResult.body?.data || [];
    await ctx.progress(40, undefined, `Parsed ${rows.length} matching row(s)`);

    if (rows.length === 0) {
      return {
        ok: true,
        insertedRows: 0,
        matchedRows: 0,
        unmatchedRows: parseResult.body?.unmatchedRows || 0,
        unmatchedBins: parseResult.body?.unmatchedBins || 0,
        totalRows: parseResult.body?.totalRows || 0,
        message: "No rows matched the master BIN data; nothing was saved."
      };
    }

    const saveResult = await invokeHandler(returnSave, replayContext({ body: { data: rows }, auth: user }));
    if (saveResult.status !== 200) {
      return {
        ok: false,
        stage: "save",
        error: saveResult.body?.error || "Failed to save the parsed data.",
        missingDivisions: saveResult.body?.missingDivisions,
        missingCircles: saveResult.body?.missingCircles
      };
    }

    await ctx.progress(100, undefined, "Completed");
    return {
      ok: true,
      insertedRows: saveResult.body?.insertedRows ?? rows.length,
      skippedNumericFields: saveResult.body?.skippedNumericFields ?? 0,
      matchedRows: rows.length,
      unmatchedRows: parseResult.body?.unmatchedRows || 0,
      unmatchedBins: parseResult.body?.unmatchedBins || 0,
      totalRows: parseResult.body?.totalRows || rows.length
    };
  } finally {
    await tmp.delete(payload.fileKey).catch(() => {});
  }
}

export function registerReturnImportJob() {
  registerJobHandler(RETURN_IMPORT_JOB, handler as any);
}
