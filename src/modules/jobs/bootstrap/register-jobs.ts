import { registeredJobTypes, recoverInterruptedJobs } from "@/modules/jobs/services/job-runner.js";
import { registerMaintenanceJob } from "@/modules/jobs/services/maintenance-job.js";
import { registerReturnImportJob } from "@/modules/return-data-analyser/jobs/import.job.js";
import { registerBinImportJob } from "@/modules/bin-analyser/jobs/import.job.js";

/**
 * Why: §3.1 — job handlers must exist before any request enqueues work, and any
 *      job orphaned by the previous process should be resumed.
 * When: Kernel startup, after the database is ready and before routes serve.
 * Where: src/modules/jobs/bootstrap/register-jobs.ts.
 * How: Registers import handlers, then recovers stale jobs (best-effort).
 */
export default async function bootstrapBackgroundJobs() {
  registerReturnImportJob();
  registerBinImportJob();
  registerMaintenanceJob();

  try {
    const recovered = await recoverInterruptedJobs();
    if (recovered > 0) {
      console.log(`[jobs] re-dispatched ${recovered} interrupted background job(s)`);
    }
  } catch (error: any) {
    console.error("[jobs] recovery sweep failed:", error?.message || error);
  }

  return registeredJobTypes();
}
