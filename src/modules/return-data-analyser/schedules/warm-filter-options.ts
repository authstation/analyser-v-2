import { defineSchedule } from "@/framework/facade.js";
import { warmFilterOptionsCaches } from "../services/warm-caches.js";

/**
 * Why: §2.4 — keep the dashboard dropdown cache warm so users never wait on a
 *      cold `filter-options` computation, even after a restart or lull.
 * When: Every 15 minutes; once at scheduler boot.
 * Where: `schedule:work` runtime (module schedule discovery).
 * How: Delegates to the shared warmer, which itself holds a distributed lock so
 *      the boot run and the first tick cannot overlap.
 */
defineSchedule({
  name: "return-data:warm-filter-options",
  expression: "*/15 * * * *",
  runOnInit: true,
  ttlMs: 10 * 60 * 1000,
  handler: async () => {
    const { ran, warmed } = await warmFilterOptionsCaches();
    if (ran) console.log(`return-data: warmed ${warmed} filter-options scope(s)`);
  }
});
