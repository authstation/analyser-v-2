import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import {
  getAllSubscriptions,
  updateSubscriptionStatus,
  getMySubscriptions,
  requestSubscription,
  buySingleCircle,
  changeCircleSubscription,
} from "@/modules/subscriptions/controllers/subscriptions.controller.js";

const router = createRouter();

// User routes
router.get("/my", authMiddleware, getMySubscriptions);
router.post("/request", authMiddleware, requestSubscription);
router.post("/buy-single-circle", authMiddleware, buySingleCircle);
router.post("/change-circle", authMiddleware, changeCircleSubscription);

// Admin-only management routes
router.get("/admin/all", authMiddleware, requireRole("admin"), getAllSubscriptions);
router.post("/admin/status", authMiddleware, requireRole("admin"), updateSubscriptionStatus);

export default router;
