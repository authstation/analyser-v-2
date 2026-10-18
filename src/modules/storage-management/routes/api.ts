import { createRoute, group, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import { downloadBackup, getOverview, restoreBackup } from "@/modules/storage-management/controllers/storage-management.controller.js";

const overviewRoute = createRoute({
  path: "/overview",
  method: "get",
  tags: ["StorageManagement"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Database storage overview and user usage")
  }
});

const downloadBackupRoute = createRoute({
  path: "/backup/download",
  method: "get",
  tags: ["StorageManagement"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Database SQL backup download")
  }
});

const restoreBackupRoute = createRoute({
  path: "/backup/restore",
  method: "post",
  tags: ["StorageManagement"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Database restore result")
  }
});

export const alias = "/api/storage-management";

export default group(authMiddleware, requireRole("admin"))
  .api(overviewRoute, getOverview)
  .api(downloadBackupRoute, downloadBackup)
  .api(restoreBackupRoute, restoreBackup);
