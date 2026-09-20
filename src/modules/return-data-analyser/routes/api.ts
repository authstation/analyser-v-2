import { createRoute, group, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { filterOptions, analytics, fyComparison, yearComparison, list, searchOptions, deleteAll, parse, save, drilldownEntities, entityTrends, entityDetailsReport, nonFilerList } from "@/modules/return-data-analyser/controllers/return-data.controller.js";

const filterOptionsRoute = createRoute({
  path: "/filter-options",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Filter options fetched successfully")
  }
});

const analyticsRoute = createRoute({
  path: "/analytics",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Analytics fetched successfully")
  }
});

const fyComparisonRoute = createRoute({
  path: "/fy-comparison",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "FY Comparison fetched successfully")
  }
});

const yearComparisonRoute = createRoute({
  path: "/year-comparison",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Year Comparison fetched successfully")
  }
});

const listRoute = createRoute({
  path: "/list",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "List fetched successfully")
  }
});

const searchOptionsRoute = createRoute({
  path: "/search-options",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Search options fetched successfully")
  }
});

const deleteAllRoute = createRoute({
  path: "/delete-all",
  method: "delete",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Deleted successfully")
  }
});

const parseRoute = createRoute({
  path: "/parse",
  method: "post",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Parsed successfully")
  }
});

const saveRoute = createRoute({
  path: "/save",
  method: "post",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Saved successfully")
  }
});

const drilldownEntitiesRoute = createRoute({
  path: "/drilldown-entities",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Drilldown entities fetched successfully")
  }
});

const entityTrendsRoute = createRoute({
  path: "/entity-trends",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Entity trends fetched successfully")
  }
});

const entityDetailsReportRoute = createRoute({
  path: "/entity-details-report",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Entity details report fetched successfully")
  }
});

const nonFilerListRoute = createRoute({
  path: "/non-filer-list",
  method: "get",
  tags: ["ReturnDataAnalyser"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Non Filer List fetched successfully")
  }
});

export default group(authMiddleware)
  .api(filterOptionsRoute, filterOptions)
  .api(analyticsRoute, analytics)
  .api(fyComparisonRoute, fyComparison)
  .api(yearComparisonRoute, yearComparison)
  .api(listRoute, list)
  .api(searchOptionsRoute, searchOptions)
  .api(deleteAllRoute, deleteAll)
  .api(parseRoute, parse)
  .api(saveRoute, save)
  .api(drilldownEntitiesRoute, drilldownEntities)
  .api(entityTrendsRoute, entityTrends)
  .api(entityDetailsReportRoute, entityDetailsReport)
  .api(nonFilerListRoute, nonFilerList);

