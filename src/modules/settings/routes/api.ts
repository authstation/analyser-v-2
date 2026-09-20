import { createRouter } from "@/framework/facade.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";

// Import Controllers
import { getAppSettings, updateAppSetting } from "@/modules/settings/controllers/app-settings.js";
import { getDivisions, createDivision, updateDivision, deleteDivision } from "@/modules/settings/controllers/divisions.js";
import { getCircles, createCircle, updateCircle, deleteCircle } from "@/modules/settings/controllers/circles.js";
import { getPenalties, createPenalty, updatePenalty, deletePenalty } from "@/modules/settings/controllers/penalties.js";
import { getMappings, updateMappings } from "@/modules/settings/controllers/mappings.js";
import { getPoliceStations } from "@/modules/settings/controllers/police-stations.js";
import { getItemMappings, createItemMapping, updateItemMapping, deleteItemMapping } from "@/modules/settings/controllers/item-mappings.js";
import { getOffices, createOffice } from "@/modules/settings/controllers/offices.js";

const router = createRouter();

// Public reading endpoints for registration / forms
router.get("/circles", getCircles);
router.get("/divisions", getDivisions);

// App Settings (Limits & Module Statuses)
router.get("/app-settings", authMiddleware, getAppSettings);
router.put("/app-settings/:key", authMiddleware, requireRole('admin'), updateAppSetting);

// Divisions Management
router.post("/divisions", authMiddleware, requireRole('admin'), createDivision);
router.put("/divisions/:id", authMiddleware, requireRole('admin'), updateDivision);
router.delete("/divisions/:id", authMiddleware, requireRole('admin'), deleteDivision);

// Circles Management
router.post("/circles", authMiddleware, requireRole('admin'), createCircle);
router.put("/circles/:id", authMiddleware, requireRole('admin'), updateCircle);
router.delete("/circles/:id", authMiddleware, requireRole('admin'), deleteCircle);

// Penalties
router.get("/penalties", authMiddleware, requireRole('admin'), getPenalties);
router.post("/penalties", authMiddleware, requireRole('admin'), createPenalty);
router.put("/penalties/:id", authMiddleware, requireRole('admin'), updatePenalty);
router.delete("/penalties/:id", authMiddleware, requireRole('admin'), deletePenalty);

// Mappings
router.get("/mappings", authMiddleware, requireRole('admin'), getMappings);
router.post("/mappings", authMiddleware, requireRole('admin'), updateMappings);

// Police Stations
router.get("/police-stations", authMiddleware, requireRole('admin'), getPoliceStations);

// Item Mappings
router.get("/item-mappings", authMiddleware, requireRole('admin'), getItemMappings);
router.post("/item-mappings", authMiddleware, requireRole('admin'), createItemMapping);
router.put("/item-mappings/:id", authMiddleware, requireRole('admin'), updateItemMapping);
router.delete("/item-mappings/:id", authMiddleware, requireRole('admin'), deleteItemMapping);

// Offices
router.get("/ibas/offices", authMiddleware, requireRole('admin'), getOffices);
router.post("/ibas/offices", authMiddleware, requireRole('admin'), createOffice);

export default router;
