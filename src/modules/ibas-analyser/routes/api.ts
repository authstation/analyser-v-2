import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import {
  parse,
  save,
  requestMapping,
  getOffices,
  createOffice,
  updateOffice,
  deleteOffice,
  dashboardReport,
  byOfficeReport,
  byItemReport,
  summaryReport
} from "../controllers/ibas.controller.js";

const router = createRouter();

// Upload and parsing
router.post("/parse", authMiddleware, parse);
router.post("/save", authMiddleware, save);
router.post("/request-mapping", authMiddleware, requestMapping);

// Offices CRUD
router.get("/offices", authMiddleware, getOffices);
router.post("/offices", authMiddleware, requireRole("admin"), createOffice);
router.put("/offices/:id", authMiddleware, requireRole("admin"), updateOffice);
router.delete("/offices/:id", authMiddleware, requireRole("admin"), deleteOffice);

// Reports
router.get("/reports/dashboard", authMiddleware, dashboardReport);
router.get("/reports/by-office", authMiddleware, byOfficeReport);
router.get("/reports/by-item", authMiddleware, byItemReport);
router.get("/reports/summary", authMiddleware, summaryReport);

export default router;
export const alias = ["/api/ibas"];
