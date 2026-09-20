import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import { index, update } from "@/modules/users/controllers/users.controller.js";

const router = createRouter();

// Admin user management routes
router.get("/", authMiddleware, requireRole("admin"), index);
router.put("/:id", authMiddleware, requireRole("admin"), update);

export default router;
