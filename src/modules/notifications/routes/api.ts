import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { index, markAllAsRead } from "@/modules/notifications/controllers/notifications.controller.js";

const router = createRouter();

router.get("/", authMiddleware, index);
router.post("/read-all", authMiddleware, markAllAsRead);

export default router;
