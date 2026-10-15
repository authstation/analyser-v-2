import { getJob, listJobs } from "@/modules/jobs/services/job-runner.js";

/**
 * Why: §3.1 — clients poll a job's status instead of waiting on the request.
 * When: `GET /api/jobs/:id`.
 * Where: src/modules/jobs/controllers/job.controller.ts.
 * How: Loads the row; a non-admin may only read jobs they created (system jobs
 *      with no owner are readable by any authenticated user).
 */
export async function jobStatus(c: any) {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "A valid job id is required." }, 400);
  }

  const job = await getJob(id);
  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  const auth = c.get("auth") as { id?: number; role?: string } | undefined;
  const isAdmin = String(auth?.role ?? "").toLowerCase() === "admin";
  if (!isAdmin && job.createdBy != null && Number(job.createdBy) !== Number(auth?.id)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json({ job: serializeJob(job) });
}

/**
 * Why: §3.1 — observability / debugging of the background job table.
 * When: `GET /api/jobs?type=&status=&limit=`.
 * Where: src/modules/jobs/controllers/job.controller.ts.
 * How: Admin-only listing, newest first.
 */
export async function jobList(c: any) {
  const auth = c.get("auth") as { role?: string } | undefined;
  if (String(auth?.role ?? "").toLowerCase() !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await listJobs({
    type: c.req.query("type"),
    status: c.req.query("status"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined
  });

  return c.json({ jobs: rows.map(serializeJob) });
}

function serializeJob(job: any) {
  return {
    id: Number(job.id),
    type: job.type,
    status: job.status,
    progress: job.progress,
    total: job.total,
    message: job.message,
    error: job.error,
    result: job.result ?? null,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdBy: job.createdBy,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt
  };
}
