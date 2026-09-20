import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import { destroy, freeze, index, show, store, update, upgrade } from "@/modules/plans/controllers/plans.controller.js";

const router = createRouter();

// Public plan listing
router.get("/", index);
router.get("/:id", show);

// User upgrade route
router.post("/upgrade", authMiddleware, upgrade);

// Admin-only management routes
router.post("/", authMiddleware, requireRole("admin"), store);
router.put("/:id/freeze", authMiddleware, requireRole("admin"), freeze);
router.put("/:id", authMiddleware, requireRole("admin"), update);
router.delete("/:id", authMiddleware, requireRole("admin"), destroy);

export default router;
