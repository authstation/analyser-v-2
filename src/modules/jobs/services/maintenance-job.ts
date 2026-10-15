import { sql } from "drizzle-orm";
import { cache, db } from "@/framework/facade.js";
import { enqueueJob, registerJobHandler } from "@/modules/jobs/services/job-runner.js";
import { POST_IMPORT_MAINTENANCE_JOB } from "@/modules/jobs/services/job-types.js";
import { refreshReturnBinMonthView } from "@/modules/return-data-analyser/utils/helpers.js";
import { rebuildBinAreaDimension } from "@/modules/bin-analyser/utils/helpers.js";
import { scheduleFilterOptionsWarm } from "@/modules/return-data-analyser/services/warm-caches.js";

/**
 * Why: §3.1 — refreshing the analytics materialized view and rebuilding the BIN
 *      area dimension are the heaviest parts of a write request. They are
 *      idempotent, so they can move off the request path and run in the
 *      background, shrinking import/save latency.
 * When: After a successful import, save or delete (scheduled via
 *       `schedulePostImportMaintenance`).
 * Where: src/modules/jobs/services/maintenance-job.ts.
 * How: The handler refreshes derived state and only THEN purges caches, so a
 *      stale value cached during the refresh window is always invalidated.
 */

export type MaintenanceScope = "return" | "bin";

/**
 * Why: Performs the actual maintenance work (also awaited by the async import
 *      job so a "completed" import implies fresh derived state).
 * When: Inside the maintenance job handler, or directly from a background job.
 * Where: Maintenance job internals.
 * How: Refresh derived state first, then purge the affected cache patterns.
 */
export async function runPostImportMaintenance(scope: MaintenanceScope): Promise<void> {
  if (scope === "bin") {
    await rebuildBinAreaDimension();
    await cache.forgetPattern("bin:*");
    await cache.forgetPattern("return-data:*");
    scheduleFilterOptionsWarm();
    return;
  }

  await refreshReturnBinMonthView();
  await cache.forgetPattern("return-data:*");
}

/**
 * Why: Queues maintenance without making the caller wait for the heavy work.
 * When: End of the synchronous save/delete/import request paths.
 * Where: Return and BIN import controllers.
 * How: Skips enqueue when an identical PENDING job already exists (light
 *      coalescing for chunked uploads); a job that has already started is not
 *      coalesced so a mutation committing mid-run still triggers a later pass.
 */
export async function schedulePostImportMaintenance(scope: MaintenanceScope): Promise<number | null> {
  const pending = await db.execute(sql`
    SELECT "id" FROM "background_jobs"
    WHERE "type" = ${POST_IMPORT_MAINTENANCE_JOB}
      AND "status" = 'pending'
      AND "payload"->>'scope' = ${scope}
    LIMIT 1
  `);
  const found = Array.isArray(pending) ? pending : ((pending as any)?.rows ?? []);
  if (found.length > 0) return null;

  return enqueueJob(POST_IMPORT_MAINTENANCE_JOB, { scope });
}

export function registerMaintenanceJob(): void {
  registerJobHandler(POST_IMPORT_MAINTENANCE_JOB, async (payload: any) => {
    const scope: MaintenanceScope = payload?.scope === "bin" ? "bin" : "return";
    await runPostImportMaintenance(scope);
    return { scope, refreshedAt: new Date().toISOString() };
  });
}
