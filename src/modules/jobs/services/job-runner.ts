import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { backgroundJobs } from "@/modules/jobs/database/models/job.js";
import { queueJob } from "@/framework/queue/queue.js";
import { redisClientIfReady } from "@/framework/redis/client.js";

/**
 * Why: §3.1 — a small, Redis-optional background job runner. It lets a request
 *      end immediately while long-running work (bulk imports, post-import
 *      maintenance) continues, with durable status in Postgres.
 * When: Features call `enqueueJob`; the runner dispatches to BullMQ when Redis
 *      is configured, otherwise executes in-process (single-node) respecting a
 *      concurrency cap.
 * Where: src/modules/jobs/services/job-runner.ts.
 * How: Rows live in `background_jobs`. `executeJobById` owns the status
 *      transitions and retry policy; `dispatch` chooses queue vs in-process.
 */

export const BACKGROUND_JOB_QUEUE = "maintenance";
export const BACKGROUND_JOB_NAME = "background:run";

/**
 * Why: Redis-backed dispatch is only safe when a `queue:work` process is
 *      actually consuming the `maintenance` queue. The HTTP server does not
 *      start workers, so defaulting to in-process avoids jobs stalling in a
 *      Redis deployment that never ran a worker.
 * When: `dispatch` decides between the queue and in-process execution.
 * Where: src/modules/jobs/services/job-runner.ts.
 * How: Opt in with the `BACKGROUND_JOBS_USE_QUEUE=true` environment variable.
 */
function useQueueDispatch(): boolean {
  const flag = String(process.env.BACKGROUND_JOBS_USE_QUEUE ?? "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

/** Recover jobs whose owning process died, after they have been idle this long. */
const STALE_JOB_MINUTES = 5;

/** In-process concurrency cap (ignored when Redis-backed workers run the jobs). */
const MAX_IN_PROCESS_CONCURRENCY = 2;

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type JobProgress = (progress: number, total?: number, message?: string) => Promise<void>;

export type JobContext = {
  jobId: number;
  progress: JobProgress;
};

export type JobHandler = (payload: any, ctx: JobContext) => Promise<any>;

const handlers = new Map<string, JobHandler>();
const inFlight = new Set<number>();
const waiting: number[] = [];
let activeCount = 0;

/**
 * Why: Associates a job type with the function that performs its work.
 * When: Module bootstrap (runs in every process so the HTTP node can also run
 *       in-process jobs when Redis is absent).
 * Where: `src/modules/jobs/bootstrap/register-jobs.ts`.
 * How: Stores the handler in an in-memory registry keyed by job type.
 */
export function registerJobHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

export function getJobHandler(type: string) {
  return handlers.get(type);
}

export function registeredJobTypes() {
  return [...handlers.keys()];
}

/**
 * Why: Creates a durable job row and starts it.
 * When: A caller wants work done outside the request lifecycle.
 * Where: Import endpoints and post-import maintenance.
 * How: Inserts a `pending` row, then dispatches (queue when Redis is present,
 *      otherwise in-process).
 */
export async function enqueueJob(
  type: string,
  payload: any,
  options: { createdBy?: number | null; maxAttempts?: number } = {}
): Promise<number> {
  if (!handlers.has(type)) {
    throw new Error(`No background job handler registered for type "${type}".`);
  }

  const [row] = await db
    .insert(backgroundJobs)
    .values({
      type,
      payload: payload ?? null,
      status: "pending",
      maxAttempts: options.maxAttempts ?? 3,
      createdBy: options.createdBy ?? null
    })
    .returning({ id: backgroundJobs.id });

  const id = Number(row.id);
  void dispatch(id);
  return id;
}

/**
 * Why: Reads a single job for status polling.
 * When: `GET /api/jobs/:id`.
 * Where: Jobs controller.
 * How: Primary-key lookup.
 */
export async function getJob(id: number) {
  const [row] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, id)).limit(1);
  return row ?? null;
}

/**
 * Why: Lists recent jobs (admin/observability).
 * When: Jobs listing endpoint or debugging.
 * Where: Jobs controller.
 * How: Optional type/status filters, newest first.
 */
export async function listJobs(options: { type?: string; status?: string; limit?: number } = {}) {
  const conditions = [];
  if (options.type) conditions.push(eq(backgroundJobs.type, options.type));
  if (options.status) conditions.push(eq(backgroundJobs.status, options.status));

  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  return db
    .select()
    .from(backgroundJobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(backgroundJobs.id))
    .limit(limit);
}

/**
 * Why: Decides how a job should run.
 * When: After enqueue, on retry, or after crash recovery.
 * Where: Runner internals.
 * How: Uses BullMQ when explicitly enabled AND Redis is available (a worker
 *      process must be consuming the `maintenance` queue), otherwise runs in the
 *      current process.
 */
async function dispatch(jobId: number) {
  if (useQueueDispatch() && redisClientIfReady()) {
    try {
      const job = await queueJob(
        BACKGROUND_JOB_NAME,
        { jobId },
        {
          queue: BACKGROUND_JOB_QUEUE,
          jobId: `bg-${jobId}-${Date.now()}`,
          removeOnComplete: 200,
          removeOnFail: 200
        }
      );
      if (job) return;
    } catch {
      // Fall through to in-process execution if Redis is reachable but enqueue fails.
    }
  }

  scheduleInProcess(jobId);
}

/**
 * Why: Runs jobs in the current process with a bounded concurrency.
 * When: Redis is not configured (local/single-node deployments).
 * Where: Runner internals.
 * How: Maintains a FIFO wait list pumped while under the concurrency cap.
 */
function scheduleInProcess(jobId: number) {
  if (inFlight.has(jobId) || waiting.includes(jobId)) return;
  waiting.push(jobId);
  pumpInProcess();
}

function pumpInProcess() {
  while (activeCount < MAX_IN_PROCESS_CONCURRENCY && waiting.length > 0) {
    const jobId = waiting.shift() as number;
    if (inFlight.has(jobId)) continue;

    activeCount++;
    inFlight.add(jobId);
    void executeJobById(jobId).finally(() => {
      activeCount--;
      inFlight.delete(jobId);
      pumpInProcess();
    });
  }
}

/**
 * Why: Runs one job and owns its status transitions + retry policy.
 * When: In-process dispatch, or a BullMQ worker consuming a queued job.
 * Where: Runner internals and `jobs/background.job.ts`.
 * How: Marks running (increments attempts), invokes the handler with a
 *      `progress` reporter, then records completed/failed. Failures are retried
 *      with backoff until `max_attempts`.
 */
export async function executeJobById(jobId: number) {
  const [row] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).limit(1);
  if (!row) return;
  if (row.status === "completed") return;

  const handler = handlers.get(row.type);
  if (!handler) {
    await db
      .update(backgroundJobs)
      .set({ status: "failed", error: `No handler registered for type "${row.type}".`, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(backgroundJobs.id, jobId));
    return;
  }

  await db
    .update(backgroundJobs)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date(), error: null, attempts: sql`"attempts" + 1` })
    .where(eq(backgroundJobs.id, jobId));

  const progress: JobProgress = async (value, total, message) => {
    await db
      .update(backgroundJobs)
      .set({
        progress: Math.max(0, Math.min(100, Math.round(value))),
        ...(total !== undefined ? { total } : {}),
        ...(message !== undefined ? { message } : {}),
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, jobId));
  };

  try {
    const result = await handler(row.payload, { jobId, progress });
    await db
      .update(backgroundJobs)
      .set({ status: "completed", result: result ?? null, progress: 100, message: null, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(backgroundJobs.id, jobId));
  } catch (error: any) {
    const message = error?.message || String(error);
    const attempts = Number(row.attempts) + 1;
    const maxAttempts = Number(row.maxAttempts) || 1;

    if (attempts < maxAttempts) {
      await db
        .update(backgroundJobs)
        .set({ status: "pending", error: message, updatedAt: new Date() })
        .where(eq(backgroundJobs.id, jobId));
      const backoffMs = Math.min(30_000, 2 ** attempts * 1000);
      setTimeout(() => void dispatch(jobId), backoffMs).unref?.();
    } else {
      await db
        .update(backgroundJobs)
        .set({ status: "failed", error: message, finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(backgroundJobs.id, jobId));
    }
  }
}

/**
 * Why: Re-queues jobs left pending/running by a process that died.
 * When: Boot (via the jobs bootstrap), so imports interrupted by a redeploy are
 *       not silently lost.
 * Where: src/modules/jobs/bootstrap/register-jobs.ts.
 * How: Resets stale `running` rows to `pending`, then dispatches rows idle for
 *      longer than `STALE_JOB_MINUTES` (bounded per sweep).
 */
export async function recoverInterruptedJobs(limit = 50) {
  const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60 * 1000);

  await db
    .update(backgroundJobs)
    .set({ status: "pending", updatedAt: new Date() })
    .where(and(eq(backgroundJobs.status, "running"), lt(backgroundJobs.updatedAt, cutoff)));

  const stale = await db
    .select({ id: backgroundJobs.id })
    .from(backgroundJobs)
    .where(and(inArray(backgroundJobs.status, ["pending", "running"]), lt(backgroundJobs.updatedAt, cutoff)))
    .orderBy(backgroundJobs.id)
    .limit(limit);

  for (const row of stale) {
    void dispatch(Number(row.id));
  }

  return stale.length;
}

/**
 * Why: Deletes old terminal jobs so the table does not grow without bound.
 * When: Periodic maintenance / manual cleanup.
 * Where: Jobs maintenance.
 * How: Removes completed/failed rows older than `days`.
 */
export async function pruneJobs(days = 14) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await db
    .delete(backgroundJobs)
    .where(and(inArray(backgroundJobs.status, ["completed", "failed"]), lt(backgroundJobs.createdAt, cutoff)));
}
