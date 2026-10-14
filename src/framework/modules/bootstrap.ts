import { discoverModuleFiles, importFile } from "@/framework/modules/discover.js";

/**
 * Why: Auto-discovers and executes module startup bootstrap hooks.
 * When: HTTP app kernel startup after database is initialized.
 * Where: Kernel startup.
 * How: Scans src/modules/** /bootstrap/*.{ts,js} and executes exported bootstrap functions.
 */
export async function runModuleBootstraps() {
  const files = await discoverModuleFiles("**/bootstrap/*.{ts,js}");

  for (const file of files) {
    const mod = await importFile(file);
    if (typeof mod.default === "function") {
      await mod.default();
    } else {
      for (const [key, fn] of Object.entries(mod)) {
        if (typeof fn === "function" && (key.startsWith("bootstrap") || key === "init")) {
          await fn();
        }
      }
    }
  }

  return files.length;
}
