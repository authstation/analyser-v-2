import { cache, db } from "@/framework/facade.js";
import { sql, type SQL } from "drizzle-orm";
import { extractRows } from "../utils/helpers.js";

/**
 * Why: `filter-options` powers every dashboard dropdown and is expensive enough
 *      to cache; keeping the cache key *scope-based* (rather than user-based)
 *      lets users who share a scope share one payload and lets a background
 *      warmer pre-populate the common scopes.
 * When: Page load, warmer runs, and after imports (cache invalidated).
 * Where: GET /return-data-analyser/filter-options + the warm job.
 * How: Pure computation reads the small `bin_area_dimension` table (§2.3) with
 *      a handful of set-based queries and is served stale-while-revalidate.
 */

/** Freshness window for the dropdown payload (matches the controller TTL). */
const FILTER_OPTIONS_TTL_SECONDS = 86400;

/** `IN ($1, $2, ...)` list for a set of ids. */
const idList = (ids: number[]): SQL => sql.join(ids.map((id) => sql`${id}`), sql`, `);

export type FilterOptionsScope = {
  /** null => unrestricted (admin); [] => no circles; [..] => subset. */
  approvedCircleIds: number[] | null;
  /** Explicit circle names passed via `?circles=`/`?circle=`. */
  circles: string[];
  /** Optional date range for date-aware dropdowns. */
  fromDate?: string | null;
  toDate?: string | null;
};

/**
 * Why: The dropdown payload depends on the requested scope (circles + optional dates),
 *      never on the identity of the caller, so the key encodes the scope.
 * When: Both the controller and the warmer build the same key.
 * Where: filter-options read path.
 * How: Canonical, order-independent rendering of circle ids, circle names, and date bounds.
 */
export function filterOptionsCacheKey(scope: FilterOptionsScope): string {
  const circleIds =
    scope.approvedCircleIds === null
      ? "all"
      : scope.approvedCircleIds.slice().sort((a, b) => a - b).join("-") || "none";
  const circleNames = scope.circles.length ? scope.circles.slice().sort().join("|") : "all";
  const dateKey = `${scope.fromDate || "none"}_${scope.toDate || "none"}`;
  return `return-data:filter-options:${circleIds}:${circleNames}:${dateKey}`;
}

/**
 * Why: Single source of truth for the dropdown payload so the request path and
 *      the warmer cannot drift apart.
 * When: Cache miss / stale refresh / warming.
 * Where: Called by `getFilterOptions` only.
 * How: Reads the precomputed `bin_area_dimension` relations plus the small
 *      distinct-value columns; no per-row JS expansion.
 */
export async function buildFilterOptions(scope: FilterOptionsScope) {
  const { approvedCircleIds, circles: circlesArr } = scope;

  // null => admin (all circles); [] => no approved circles; [..] => subset
  const circleScope =
    approvedCircleIds === null
      ? sql``
      : approvedCircleIds.length === 0
        ? sql`AND FALSE`
        : sql`AND "bin_data"."circle_id" IN (${idList(approvedCircleIds)})`;

  const [circlesList, policeStationsList, statuses, regTypes, tokenSets, relations] = await Promise.all([
    db.execute(sql`
      SELECT DISTINCT "circles"."name" AS "name"
      FROM "bin_data"
      INNER JOIN "circles" ON "bin_data"."circle_id" = "circles"."id"
      WHERE "circles"."name" IS NOT NULL AND "circles"."name" <> '' ${circleScope}
      ORDER BY "name"
    `),
    circlesArr.length > 0
      ? db.execute(sql`
          SELECT DISTINCT "police_stations"."name" AS "name"
          FROM "police_stations"
          LEFT JOIN "circles" ON "police_stations"."circle_id" = "circles"."id"
          WHERE "police_stations"."name" IS NOT NULL AND "police_stations"."name" <> ''
            AND "circles"."name" IN (${sql.join(circlesArr.map((n) => sql`${n}`), sql`, `)})
          ORDER BY "name"
        `)
      : db.execute(sql`
          SELECT DISTINCT "police_stations"."name" AS "name"
          FROM "police_stations"
          WHERE "police_stations"."name" IS NOT NULL AND "police_stations"."name" <> ''
          ORDER BY "name"
        `),
    db.execute(sql`
      SELECT DISTINCT "bin_status" AS "name"
      FROM "bin_data"
      WHERE "bin_status" IS NOT NULL AND "bin_status" <> ''
      ORDER BY "name"
    `),
    db.execute(sql`
      SELECT DISTINCT "forced_registration" AS "name"
      FROM "bin_data"
      WHERE "forced_registration" IS NOT NULL AND "forced_registration" <> ''
      ORDER BY "name"
    `),
    // §2.3: tokens come from the tiny dimension table when no date filter is passed,
    // or dynamically computed from bin_data if date range is specified.
    scope.fromDate || scope.toDate
      ? db.execute(sql`
          WITH filtered_bins AS (
            SELECT "major_areas", "manufacturing_areas", "service_areas"
            FROM "bin_data"
            WHERE 1=1 ${circleScope}
              ${scope.fromDate ? sql`AND "bin_issue_date" >= cast(${scope.fromDate + " 00:00:00"} as timestamp)` : sql``}
              ${scope.toDate ? sql`AND "bin_issue_date" <= cast(${scope.toDate + " 23:59:59"} as timestamp)` : sql``}
          )
          SELECT
            (SELECT array_agg(DISTINCT maj ORDER BY maj) FROM filtered_bins b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj WHERE maj IS NOT NULL) AS "majors",
            (SELECT array_agg(DISTINCT mf ORDER BY mf) FROM filtered_bins b, unnest(COALESCE(b."manufacturing_areas", '{}'::text[])) AS mf WHERE mf IS NOT NULL) AS "mfgs",
            (SELECT array_agg(DISTINCT sv ORDER BY sv) FROM filtered_bins b, unnest(COALESCE(b."service_areas", '{}'::text[])) AS sv WHERE sv IS NOT NULL) AS "services"
        `)
      : db.execute(sql`
          SELECT
            (SELECT array_agg(DISTINCT "major" ORDER BY "major") FROM "bin_area_dimension" WHERE "major" IS NOT NULL) AS "majors",
            (SELECT array_agg(DISTINCT "mfg" ORDER BY "mfg") FROM "bin_area_dimension" WHERE "mfg" IS NOT NULL) AS "mfgs",
            (SELECT array_agg(DISTINCT "service" ORDER BY "service") FROM "bin_area_dimension" WHERE "service" IS NOT NULL) AS "services"
        `),
    scope.fromDate || scope.toDate
      ? db.execute(sql`
          WITH filtered_bins AS (
            SELECT "major_areas", "manufacturing_areas", "service_areas"
            FROM "bin_data"
            WHERE 1=1 ${circleScope}
              ${scope.fromDate ? sql`AND "bin_issue_date" >= cast(${scope.fromDate + " 00:00:00"} as timestamp)` : sql``}
              ${scope.toDate ? sql`AND "bin_issue_date" <= cast(${scope.toDate + " 23:59:59"} as timestamp)` : sql``}
          )
          SELECT DISTINCT "major", "mfg", "service" FROM (
            SELECT maj AS "major", mf AS "mfg", NULL::text AS "service"
            FROM filtered_bins b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj, unnest(COALESCE(b."manufacturing_areas", '{}'::text[])) AS mf
            UNION
            SELECT maj AS "major", NULL::text AS "mfg", sv AS "service"
            FROM filtered_bins b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj, unnest(COALESCE(b."service_areas", '{}'::text[])) AS sv
            UNION
            SELECT maj AS "major", NULL::text AS "mfg", NULL::text AS "service"
            FROM filtered_bins b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj
            WHERE COALESCE(cardinality(b."manufacturing_areas"), 0) = 0
              AND COALESCE(cardinality(b."service_areas"), 0) = 0
          ) rel
          ORDER BY "major", "mfg", "service"
        `)
      : db.execute(sql`
          SELECT DISTINCT "major", "mfg", "service"
          FROM "bin_area_dimension"
          ORDER BY "major", "mfg", "service"
        `)
  ]);

  const tokens = (extractRows(tokenSets)[0] || {}) as any;
  const names = (result: any) =>
    extractRows(result)
      .map((r: any) => r.name)
      .filter(Boolean)
      .sort();

  return {
    circles: names(circlesList),
    policeStations: names(policeStationsList),
    statuses: names(statuses),
    regTypes: names(regTypes).map((r: string) => (r === "Yes" ? "Forced" : r === "No" ? "Regular" : r)),
    majorAreas: (tokens.majors || []).slice().sort(),
    mfgAreas: (tokens.mfgs || []).slice().sort(),
    serviceAreas: (tokens.services || []).slice().sort(),
    areaRelations: extractRows(relations).map((r: any) => ({
      major: r.major,
      mfg: r.mfg ?? null,
      service: r.service ?? null
    }))
  };
}

/** Cache-aside read with stale-while-revalidate, keyed by scope. */
export async function getFilterOptions(scope: FilterOptionsScope) {
  return cache.rememberSWR(filterOptionsCacheKey(scope), FILTER_OPTIONS_TTL_SECONDS, () =>
    buildFilterOptions(scope)
  );
}
