import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { jobList, jobStatus } from "@/modules/jobs/controllers/job.controller.js";

/**
 * Why: §3.1 — exposes background job status for polling after an async import.
 * When: Mounted automatically at `/api/jobs` by the module route registrar.
 * Where: src/modules/jobs/routes/api.ts.
 * How: Authenticated GET routes; listing is admin-only, status is owner-scoped.
 */
const router = createRouter();

router.get("/", authMiddleware, jobList);
router.get("/:id", authMiddleware, jobStatus);

export default router;
