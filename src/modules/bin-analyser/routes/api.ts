import { createRoute, group, HttpStatusCodes, jsonContent } from "@/framework/facade.js";
import { z } from "@/framework/facade.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { filters, allStats, list, parse, save, deleteAll, search, drilldownPivot, comparison, duplicates, exportData } from "@/modules/bin-analyser/controllers/bin-analyser.controller.js";

const listRoute = createRoute({
  path: "/list",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "List fetched successfully")
  }
});

const filtersRoute = createRoute({
  path: "/filters",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Filters fetched successfully")
  }
});

const allStatsRoute = createRoute({
  path: "/dashboard/all-stats",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Dashboard stats fetched successfully")
  }
});

const drilldownRoute = createRoute({
  path: "/dashboard/drilldown/pivot",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Drilldown fetched successfully")
  }
});

const drilldownExportRoute = createRoute({
  path: "/dashboard/drilldown/pivot/export",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Drilldown exported successfully")
  }
});

const comparisonRoute = createRoute({
  path: "/dashboard/comparison/{type}",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Comparison fetched successfully")
  }
});

const searchRoute = createRoute({
  path: "/search",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Search fetched successfully")
  }
});

const duplicatesRoute = createRoute({
  path: "/duplicates",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Duplicates fetched successfully")
  }
});

const exportRoute = createRoute({
  path: "/export",
  method: "get",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Export fetched successfully")
  }
});

const parseRoute = createRoute({
  path: "/parse",
  method: "post",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "File parsed successfully")
  }
});

const deleteRoute = createRoute({
  path: "/delete",
  method: "delete",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Data deleted successfully")
  }
});

const saveRoute = createRoute({
  path: "/save",
  method: "post",
  tags: ["BinAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Data saved successfully")
  }
});

export default group(authMiddleware)
  .api(listRoute, list)
  .api(filtersRoute, filters)
  .api(allStatsRoute, allStats)
  .api(drilldownRoute, drilldownPivot)
  .api(drilldownExportRoute, exportData)
  .api(comparisonRoute, comparison)
  .api(searchRoute, search)
  .api(duplicatesRoute, duplicates)
  .api(exportRoute, exportData)
  .api(parseRoute, parse)
  .api(saveRoute, save)
  .api(deleteRoute, deleteAll);

