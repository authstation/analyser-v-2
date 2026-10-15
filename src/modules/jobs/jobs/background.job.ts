import { shouldQueue } from "@/framework/queue/queue.js";
import { BACKGROUND_JOB_NAME, BACKGROUND_JOB_QUEUE, executeJobById } from "@/modules/jobs/services/job-runner.js";

/**
 * Why: §3.1 — when Redis is configured, background jobs should be executed by a
 *      dedicated `queue:work background` process rather than the HTTP process.
 * When: Loaded by `bootQueueJobs()` at startup (and consumed when running
 *       `startQueueWorker(["background"])`).
 * Where: src/modules/jobs/jobs/background.job.ts.
 * How: One generic handler that receives `{ jobId }` and runs the stored job.
 */
shouldQueue(BACKGROUND_JOB_NAME, BACKGROUND_JOB_QUEUE, async (job) => {
  const jobId = Number((job as any)?.data?.jobId);
  if (!jobId) return;
  await executeJobById(jobId);
});
