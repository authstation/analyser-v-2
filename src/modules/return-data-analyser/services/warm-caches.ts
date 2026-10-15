import { db } from "@/framework/facade.js";
import { sql } from "drizzle-orm";
import { runWithLock } from "@/framework/scheduler/lock.js";
import { extractRows } from "../utils/helpers.js";
import { getFilterOptions } from "./filter-options.service.js";

/**
 * Why: §2.4 — compute the dashboard's dropdown payload ahead of the first
 *      request so cold visitors and post-import traffic never pay for it, and
 *      guard the work with a distributed lock so a fleet of instances (or the
 *      scheduler + an import) do not all recompute at once.
 * When: On a schedule, and fire-and-forget right after a BIN import/delete
 *       (return-data imports do not change these dropdowns).
 * Where: `schedules/warm-filter-options.ts` and the BIN import controller.
 * How: `runWithLock` (Redis NX when available, otherwise the DB lock table)
 *      serialises the run; each scope is written through the same
 *      `getFilterOptions` cache path the API reads from.
 */
export async function warmFilterOptionsCaches(): Promise<{ ran: boolean; warmed: number }> {
  const outcome = (await runWithLock(
    "return-data:warm-filter-options:lock",
    async () => {
      let warmed = 0;

      // Global (admin) scope — the most frequently requested payload.
      await getFilterOptions({ approvedCircleIds: null, circles: [] });
      warmed++;

      // Per-circle scopes — non-admin users are scoped to their approved circles.
      const rows = extractRows(await db.execute(sql`SELECT "id" FROM "circles" ORDER BY "id"`));
      for (const row of rows) {
        await getFilterOptions({ approvedCircleIds: [Number(row.id)], circles: [] });
        warmed++;
      }

      return warmed;
    },
    { ttlMs: 10 * 60 * 1000 }
  )) as { ran: boolean; result?: number };

  return { ran: outcome.ran, warmed: outcome.result ?? 0 };
}

/**
 * Why: Imports change the data behind every dropdown; warming right after keeps
 *      the next request fast without blocking the import response.
 * When: Called (not awaited) at the end of successful BIN imports/deletes.
 * Where: bin-import controller.
 * How: Swallows errors — a cache warm must never fail an import.
 */
export function scheduleFilterOptionsWarm(): void {
  void warmFilterOptionsCaches().catch((error) => {
    console.warn("filter-options warm failed:", (error as any)?.message || error);
  });
}
