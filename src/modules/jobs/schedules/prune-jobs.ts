import { defineSchedule } from "@/framework/facade.js";
import { pruneJobs } from "@/modules/jobs/services/job-runner.js";

/**
 * Why: §3.1 — terminal background-job rows are only useful for a short while;
 *      pruning keeps `background_jobs` from growing without bound.
 * When: Daily at 03:15.
 * Where: `schedule:work` runtime (module schedule discovery).
 * How: Deletes completed/failed jobs older than 14 days.
 */
defineSchedule({
  name: "jobs:prune-background-jobs",
  expression: "15 3 * * *",
  runOnInit: false,
  ttlMs: 20 * 60 * 1000,
  handler: async () => {
    await pruneJobs(14);
  }
});
