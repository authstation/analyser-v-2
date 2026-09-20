import type { OpenAPIHono } from "@hono/zod-openapi";
import { discoverModuleFiles, importFile, moduleNameFromPath } from "@/framework/modules/discover.js";

/**
 * Why: Auto-registers module route files under `/api/<module>`.
 * When: HTTP app bootstraps module routing.
 * Where: Kernel startup.
 * How: Discovers route files, imports defaults, mounts by module name.
 */
export async function registerModuleRoutes(app: OpenAPIHono) {
  const files = await discoverModuleFiles("**/routes/*.{ts,js}");

  for (const file of files) {
    const route = await importFile(file);

    if (route.default) {
      const modName = moduleNameFromPath(file);
      app.route(`/api/${modName}`, route.default);

      // Alias for modules with hyphenated names like return-data-analyser -> return-data
      if (modName === "return-data-analyser") {
        app.route(`/api/return-data`, route.default);
      }
    }
  }

  return files.length;
}
