import type { Handler } from "hono";
import { db, cache } from "@/framework/facade.js";
import { sql, type SQL } from "drizzle-orm";
import {
  getUserApprovedCircleIds,
  resolveAllowedCircleIds,
  extractRows,
  parseAreaParam,
  monthRange,
  monthBefore,
  areaOverlap
} from "../utils/helpers.js";
import { getFilterOptions } from "../services/filter-options.service.js";

// ---------------------------------------------------------------------------
// Shared SQL fragments
// ---------------------------------------------------------------------------

/** Fixed (non-user) identifier / column expression -> safe raw SQL. */
const raw = (expression: string): SQL => sql.raw(expression);

/** First day of a "YYYY-MM" month as an index-friendly timestamp. */
const monthStartTs = (ym: string): SQL => sql`(to_date(${`${ym}-01`}, 'YYYY-MM-DD')::timestamp)`;

/** Exclusive upper bound of a "YYYY-MM" month. */
const monthEndExclusiveTs = (ym: string): SQL => sql`(${monthStartTs(ym)} + interval '1 month')`;

/** `IN ($1, $2, ...)` list for a set of ids. */
const idList = (ids: number[]): SQL => sql.join(ids.map((id) => sql`${id}`), sql`, `);

/** How far back the risk model looks when accumulating "historical" score. */
const RISK_HISTORY_MONTHS = 60;

/** Column order of the per-(bin, month) rollup view. */
const MV_METRIC_COLUMNS = [
  "m3",
  "m4",
  "m5",
  "m6",
  "m7",
  "m8",
  "m9",
  "m10",
  "m11",
  "m12",
  "m13",
  "m14",
  "m15",
  "m16",
  "m17",
  "m18",
  "m19",
  "m20",
  "m21",
  "m22"
] as const;

/**
 * Raw-row metric definitions (mirror of mv_return_bin_month). Kept as the
 * fallback if the rollup view is unavailable so the dashboard never 500s.
 */
const RAW_METRICS: { name: string; condition: SQL }[] = [
  { name: "metric3", condition: sql`COALESCE("return_data"."total_sales_value",0) > 0 AND COALESCE("return_data"."total_payable_vat",0) > 0` },
  { name: "metric4", condition: sql`COALESCE("return_data"."total_sales_value",0) > 0 AND COALESCE("return_data"."total_payable_vat",0) = 0` },
  { name: "metric5", condition: sql`COALESCE("return_data"."total_payable_sd",0) > 0` },
  { name: "metric6", condition: sql`COALESCE("return_data"."total_input_tax_credit_value",0) > 0` },
  { name: "metric7", condition: sql`COALESCE("return_data"."increasing_adjustment",0) > 0` },
  { name: "metric8", condition: sql`COALESCE("return_data"."decreasing_adjustment",0) > 0` },
  { name: "metric9", condition: sql`COALESCE("return_data"."net_payable_vat",0) < 0` },
  { name: "metric10", condition: sql`COALESCE("return_data"."net_payable_vat",0) < -100000` },
  { name: "metric11", condition: sql`COALESCE("return_data"."net_payable_vat",0) < 0 AND COALESCE("return_data"."deposited_vat",0) > 0` },
  { name: "metric12", condition: sql`COALESCE("return_data"."net_payable_vat",0) > 100000 AND COALESCE("return_data"."deposited_vat",0) > 0` },
  { name: "metric13", condition: sql`COALESCE("return_data"."net_payable_sd",0) < 0` },
  { name: "metric14", condition: sql`COALESCE("return_data"."closing_balance_vat",0) > 0 AND COALESCE("return_data"."closing_balance_vat",0) <= 100000` },
  { name: "metric15", condition: sql`COALESCE("return_data"."closing_balance_vat",0) > 100000 AND COALESCE("return_data"."closing_balance_vat",0) <= 500000` },
  { name: "metric16", condition: sql`COALESCE("return_data"."closing_balance_vat",0) > 500000` },
  { name: "metric17", condition: sql`COALESCE("return_data"."vds_increasing",0) > 0` },
  { name: "metric18", condition: sql`COALESCE("return_data"."vds_decreasing",0) > 0` },
  { name: "metric19", condition: sql`COALESCE("return_data"."advanced_tax_paid",0) > 0` },
  { name: "metric20", condition: sql`COALESCE("return_data"."advanced_tax_paid",0) < COALESCE("return_data"."increasing_adjustment",0)` },
  { name: "metric21", condition: sql`COALESCE("return_data"."fine_penalty",0) > 0 AND COALESCE("return_data"."fine_penalty",0) = COALESCE("return_data"."decreasing_adjustment",0)` },
  { name: "metric22", condition: sql`COALESCE("return_data"."vds_increasing",0) > 0 AND COALESCE("return_data"."deposited_vat",0) < COALESCE("return_data"."vds_increasing",0)` },
  { name: "metric23", condition: sql`COALESCE("bin_data"."manufacturing_area",'') = '' AND COALESCE("return_data"."total_input_tax_credit_vat",0) > 0` }
];

/**
 * Why: Dashboard + area dropdowns.
 * When: Page load and after imports (cache invalidated).
 * Where: GET /return-data-analyser/filter-options.
 * How: Resolves the caller's scope, then delegates to the shared
 *      scope-keyed cache (§2.3/§2.4) so the payload is warm and shared between
 *      users with the same scope.
 */
export const filterOptions: Handler = async (c: any) => {
  const user = c.get("auth");
  try {
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const filterCircles = c.req.query("circles") || c.req.query("circle");
    const circlesArr = filterCircles
      ? filterCircles
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    const fromDate = c.req.query("fromIssueDate") || c.req.query("fromDate") || null;
    const toDate = c.req.query("toIssueDate") || c.req.query("toDate") || null;

    const data = await getFilterOptions({
      approvedCircleIds,
      circles: circlesArr,
      fromDate: fromDate?.trim() || null,
      toDate: toDate?.trim() || null
    });

    return c.json(data);
  } catch (error) {
    console.error("Filter Options Error:", error);
    return c.json({ error: "Failed to fetch options" }, 500);
  }
};

/**
 * Why: Main compliance dashboard.
 * When: Circle/date/area filters change.
 * Where: GET /return-data-analyser/analytics.
 * How: Every predicate keeps its column bare (index-friendly), activity
 *      filters use GIN overlap, monthly eligibility is one set-based query,
 *      the 21 metric counts read the mv_return_bin_month rollup, and the risk
 *      model reads a precomputed `risk_score` column topped by SQL LIMIT.
 */
export const analytics: Handler = async (c: any) => {
  const user = c.get("auth");
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  const circleId = c.req.query("circleId");
  const policeStationId = c.req.query("policeStationId");
  const topLimit = c.req.query("topLimit");
  const majorArea = c.req.query("majorArea");
  const mfgArea = c.req.query("mfgArea");
  const serviceArea = c.req.query("serviceArea");

  let fromDateStr = fromDate;
  let toDateStr = toDate;

  try {
    const userKey = user?.id ?? "public";
    const cacheKey = `return-data:analytics:${userKey}:${fromDate || "all"}:${toDate || "all"}:${circleId || "all"}:${policeStationId || "all"}:${topLimit || "all"}:${majorArea || "all"}:${mfgArea || "all"}:${serviceArea || "all"}`;

    const analyticsData = await cache.rememberSWR(cacheKey, 86400, async () => {
      // ── Resolve the effective period from data extents when omitted ──────
      if (!fromDateStr || !toDateStr) {
        const [binMinMax, returnMinMax] = await Promise.all([
          db.execute(sql`
            SELECT to_char(min("bin_issue_date"), 'YYYY-MM') AS min_d,
                   to_char(max("bin_issue_date"), 'YYYY-MM') AS max_d
            FROM "bin_data"
            WHERE "bin_status" NOT IN ('Cancelled', 'Suspended')
          `),
          db.execute(sql`
            SELECT to_char(min("tax_period"), 'YYYY-MM') AS min_p,
                   to_char(max("tax_period"), 'YYYY-MM') AS max_p
            FROM "return_data"
          `)
        ]);

        const binMin = extractRows(binMinMax)[0]?.min_d;
        const binMax = extractRows(binMinMax)[0]?.max_d;
        const retMin = extractRows(returnMinMax)[0]?.min_p;
        const retMax = extractRows(returnMinMax)[0]?.max_p;

        if (!fromDateStr) {
          const candidates = [binMin, retMin].filter(Boolean).map((s: string) => String(s).slice(0, 7)).sort();
          fromDateStr = candidates[0] || "2026-07";
        }
        if (!toDateStr) {
          const candidates = [binMax, retMax].filter(Boolean).map((s: string) => String(s).slice(0, 7)).sort();
          toDateStr = candidates[candidates.length - 1] || "2026-10";
        }
      }

      let cIds: number[] = [];
      if (circleId)
        cIds = circleId
          .split(",")
          .map(Number)
          .filter((n: number) => !isNaN(n));

      let psIds: number[] = [];
      if (policeStationId)
        psIds = policeStationId
          .split(",")
          .map(Number)
          .filter((n: number) => !isNaN(n));

      const majorAreas = parseAreaParam(majorArea);
      const mfgAreasParam = parseAreaParam(mfgArea);
      const serviceAreasParam = parseAreaParam(serviceArea);

      const approvedCircleIds = await getUserApprovedCircleIds(user);
      const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

      // ── Reusable predicates ─────────────────────────────────────────────
      const circlePred = (expr: string): SQL => {
        if (isUnauthorized) return sql`FALSE`;
        if (allowedCircleIds !== null && allowedCircleIds.length > 0) return sql`${raw(expr)} IN (${idList(allowedCircleIds)})`;
        return sql`TRUE`;
      };
      const psPred = (expr: string): SQL => (psIds.length > 0 ? sql`${raw(expr)} IN (${idList(psIds)})` : sql`TRUE`);
      const areaPreds = (alias: string): [SQL, SQL, SQL] => [
        areaOverlap(`"${alias}"."major_areas"`, majorAreas),
        areaOverlap(`"${alias}"."manufacturing_areas"`, mfgAreasParam),
        areaOverlap(`"${alias}"."service_areas"`, serviceAreasParam)
      ];
      // Scope over `bin_data` (+ the circle column supplied by the caller).
      const scopeOn = (binAlias: string, circleExpr: string): SQL => {
        const [m, f, s] = areaPreds(binAlias);
        return sql`${circlePred(circleExpr)} AND ${psPred(`"${binAlias}"."police_station_id"`)} AND ${m} AND ${f} AND ${s}`;
      };

      const scopeFilter = scopeOn("bin_data", '"return_data"."circle_id"');
      const binScope = scopeOn("bin_data", '"bin_data"."circle_id"');
      const mvScope = scopeOn("b", '"bm"."circle_id"');
      const dateFilter = sql`${scopeFilter} AND ${monthRange('"return_data"."tax_period"', fromDateStr, toDateStr)}`;

      // ── Monthly eligibility (one query instead of one per month) ────────
      const eligibleRows = extractRows(
        await db.execute(sql`
          SELECT to_char(m, 'YYYY-MM') AS "ym", count(DISTINCT b."bin")::int AS "cnt"
          FROM generate_series(${monthStartTs(fromDateStr)}, ${monthStartTs(toDateStr)}, interval '1 month') AS m
          LEFT JOIN "bin_data" b
            ON b."bin_status" NOT IN ('Cancelled', 'Suspended')
           AND (b."bin_issue_date" IS NULL OR b."bin_issue_date" < m + interval '1 month')
           AND ${scopeOn("b", 'b."circle_id"')}
          GROUP BY m
          ORDER BY m
        `)
      );

      const totalRegBins = eligibleRows.reduce((sum, r) => sum + (Number(r.cnt) || 0), 0);

      let totalEligibleEntities = eligibleRows.length ? Number(eligibleRows[eligibleRows.length - 1]!.cnt) || 0 : 0;
      if (eligibleRows.length === 0) {
        // Defensive: an inverted range yields no series rows.
        const fallback = extractRows(
          await db.execute(sql`
            SELECT count(DISTINCT "bin_data"."bin")::int AS "cnt"
            FROM "bin_data"
            WHERE "bin_status" NOT IN ('Cancelled', 'Suspended')
              AND ("bin_issue_date" IS NULL OR "bin_issue_date" < ${monthEndExclusiveTs(toDateStr)})
              AND ${binScope}
          `)
        );
        totalEligibleEntities = Number(fallback[0]?.cnt) || 0;
      }

      // ── Metrics + totals from the rollup view (raw fallback) ────────────
      let metricRow: any;
      try {
        metricRow = extractRows(
          await db.execute(sql`
            SELECT
              (count(DISTINCT bm."bin"))::int AS "total_bins",
              COALESCE(sum(bm."submissions"), 0)::int AS "total_submitted",
              ${sql.join(
                MV_METRIC_COLUMNS.map(
                  (colName, i) =>
                    sql`(count(DISTINCT bm."bin") FILTER (WHERE bm.${raw(`"${colName}"`)}))::int AS ${raw(`"metric${i + 3}"`)}`
                ),
                sql`, `
              )},
              (count(DISTINCT bm."bin") FILTER (WHERE bm."m23_return" AND COALESCE(b."manufacturing_area", '') = ''))::int AS "metric23"
            FROM "mv_return_bin_month" bm
            INNER JOIN "bin_data" b ON bm."bin" = b."bin"
            WHERE ${mvScope}
              AND bm."month" >= to_date(${`${fromDateStr}-01`}, 'YYYY-MM-DD')::date
              AND bm."month" <= to_date(${`${toDateStr}-01`}, 'YYYY-MM-DD')::date
          `)
        )[0];
      } catch (error) {
        console.warn("[analytics] mv_return_bin_month unavailable, using raw metric query:", (error as Error)?.message);
        metricRow = extractRows(
          await db.execute(sql`
            SELECT
              count(DISTINCT "return_data"."bin")::int AS "total_bins",
              count("return_data"."id")::int AS "total_submitted",
              ${sql.join(
                RAW_METRICS.map(
                  ({ name, condition }) =>
                    sql`(count(DISTINCT "return_data"."bin") FILTER (WHERE ${condition}))::int AS ${raw(`"${name}"`)}`
                ),
                sql`, `
              )}
            FROM "return_data"
            INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
            WHERE ${dateFilter}
          `)
        )[0];
      }

      metricRow = metricRow || {};
      const totalReturnBins = Number(metricRow.total_bins) || 0;
      const totalSubmittedReturns = Number(metricRow.total_submitted) || 0;

      const metricsFormatted: any = {};
      for (let i = 3; i <= 23; i++) metricsFormatted[`metric${i}`] = Number(metricRow[`metric${i}`]) || 0;

      // ── Activity/registration splits (cheap group-by) ─────────────────
      const byActivity = extractRows(
        await db.execute(sql`
          SELECT COALESCE("return_data"."has_activities", 'N/A') AS "activity",
                 count(DISTINCT "return_data"."bin")::int AS "count"
          FROM "return_data"
          INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
          WHERE ${dateFilter}
          GROUP BY 1
          ORDER BY "count" DESC
        `)
      ).map((r: any) => ({ activity: r.activity, count: Number(r.count) || 0 }));

      const byRegistration = extractRows(
        await db.execute(sql`
          SELECT COALESCE("bin_data"."forced_registration", 'N/A') AS "forced_registration",
                 count(DISTINCT "return_data"."bin")::int AS "count"
          FROM "return_data"
          INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
          WHERE ${dateFilter}
          GROUP BY 1 ORDER BY "count" DESC
        `)
      ).map((r: any) => ({ forced_registration: r.forced_registration, count: Number(r.count) || 0 }));

      // ── Top-N risk scoring (precomputed score, bounded history) ─────────
      let limitNum = 0;
      if (topLimit && topLimit !== "All") {
        const parsed = parseInt(topLimit, 10);
        if (!isNaN(parsed) && parsed > 0) limitNum = parsed;
      }
      const limitClause = limitNum > 0 ? sql` LIMIT ${limitNum}` : sql``;
      const historyStart = sql`(${monthStartTs(fromDateStr)} - interval '${raw(String(RISK_HISTORY_MONTHS))} months')`;

      const riskScores = extractRows(
        await db.execute(sql`
          WITH BIN_SCORES AS (
            SELECT
              "return_data"."bin",
              SUM(CASE WHEN "return_data"."tax_period" < ${monthStartTs(fromDateStr)} THEN "return_data"."risk_score" ELSE 0 END) AS historical_score,
              SUM(CASE WHEN "return_data"."tax_period" >= ${monthStartTs(fromDateStr)} AND "return_data"."tax_period" < ${monthEndExclusiveTs(toDateStr)} THEN "return_data"."risk_score" ELSE 0 END) AS current_score
            FROM "return_data"
            INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
            WHERE ${scopeFilter} AND "return_data"."tax_period" >= ${historyStart}
            GROUP BY "return_data"."bin"
          )
          SELECT "bin", historical_score, current_score, (historical_score + current_score) AS total_score
          FROM BIN_SCORES
          ORDER BY total_score DESC
          ${limitClause}
        `)
      );

      let high = 0,
        risky = 0,
        low = 0,
        safe = 0,
        newlyRisky = 0,
        improving = 0;
      for (const r of riskScores) {
        const cs = Number(r.current_score) || 0;
        const hs = Number(r.historical_score) || 0;
        const total = cs + hs;
        if (total >= 30) high++;
        else if (total >= 15) risky++;
        else if (total >= 1) low++;
        else safe++;
        if (cs > hs) newlyRisky++;
        if (hs > cs) improving++;
      }

      // ── Newly issued BINs (count + expected return slots in SQL) ────────
      const [fromY, fromM] = fromDateStr.split("-").map(Number);
      const [toY, toM] = toDateStr.split("-").map(Number);
      const fromIndex = fromY * 12 + fromM;
      const toIndex = toY * 12 + toM;

      const newBinsAgg = extractRows(
        await db.execute(sql`
          SELECT
            count(*)::int AS "total",
            COALESCE(SUM(
              ${toIndex} - GREATEST((EXTRACT(YEAR FROM "bin_issue_date")::int * 12 + EXTRACT(MONTH FROM "bin_issue_date")::int), ${fromIndex}) + 1
            ), 0)::int AS "expected"
          FROM "bin_data"
          WHERE "bin_issue_date" >= ${monthStartTs(fromDateStr)}
            AND "bin_issue_date" < ${monthEndExclusiveTs(toDateStr)}
            AND ${binScope}
        `)
      )[0] || {};
      const newBinsTotal = Number(newBinsAgg.total) || 0;
      const newBinsExpected = Number(newBinsAgg.expected) || 0;

      const newBinsFiledResult = extractRows(
        await db.execute(sql`
          SELECT
            count(DISTINCT CONCAT("return_data"."bin", '_', "return_data"."tax_period"::date))::int AS "filed",
            (count(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN CONCAT("return_data"."bin", '_', "return_data"."tax_period"::date) END))::int AS "activity_yes",
            (count(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' THEN CONCAT("return_data"."bin", '_', "return_data"."tax_period"::date) END))::int AS "activity_no"
          FROM "return_data"
          INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
          WHERE "bin_data"."bin_issue_date" >= ${monthStartTs(fromDateStr)}
            AND "bin_data"."bin_issue_date" < ${monthEndExclusiveTs(toDateStr)}
            AND "return_data"."tax_period" >= ${monthStartTs(fromDateStr)}
            AND "return_data"."tax_period" < ${monthEndExclusiveTs(toDateStr)}
            AND ${binScope}
        `)
      );

      const newBinsFiled = Number(newBinsFiledResult[0]?.filed) || 0;
      const newBinsActivityYes = Number(newBinsFiledResult[0]?.activity_yes) || 0;
      const newBinsActivityNo = Number(newBinsFiledResult[0]?.activity_no) || 0;
      const newBinsNotFiled = Math.max(0, (Number(newBinsAgg.expected) || 0) - newBinsFiled);

      const entitySubmissionPct = totalEligibleEntities > 0 ? Math.round((totalReturnBins / totalEligibleEntities) * 100 * 100) / 100 : 0;
      const returnSubmissionPct = totalRegBins > 0 ? Math.round((totalSubmittedReturns / totalRegBins) * 100 * 100) / 100 : 0;

      return {
        submissionPercentage: returnSubmissionPct,
        totalReturnBins,
        totalRegBins: totalEligibleEntities,
        totalExpectedReturns: totalRegBins,
        totalSubmittedReturns,
        entityCompliance: {
          submittedEntities: totalReturnBins,
          eligibleEntities: totalEligibleEntities,
          percentage: entitySubmissionPct
        },
        returnCompliance: {
          submittedReturns: totalSubmittedReturns,
          expectedReturns: totalRegBins,
          percentage: returnSubmissionPct
        },
        byActivity,
        byRegistration,
        riskBreakdown: { high, risky, low, safe, newlyRisky, improving },
        metrics: metricsFormatted,
        newBins: {
          total: Number(newBinsAgg.total) || 0,
          expected: Number(newBinsAgg.expected) || 0,
          filed: newBinsFiled,
          notFiled: newBinsNotFiled,
          activityYes: newBinsActivityYes,
          activityNo: newBinsActivityNo
        }
      };
    });

    return c.json({ data: analyticsData });
  } catch (error) {
    console.error("Analytics Error:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
};

/**
 * Why: Paginated return list.
 * When: Return-list page / paging.
 * Where: GET /return-data-analyser/list.
 * How: Filters keep indexed columns bare and the total row count is fetched in
 *      the same pass via a window function (with a count fallback for empty
 *      pages) instead of a second full scan.
 */
export const list: Handler = async (c: any) => {
  const user = c.get("auth");
  const { page, limit, circleId, policeStationId, fromDate, toDate, search } = c.req.query();
  const pageNum = Math.max(parseInt(page || "1") || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit || "50") || 50, 1), 200);
  const offset = (pageNum - 1) * limitNum;

  try {
    let cIds: number[] = [];
    if (circleId)
      cIds = circleId
        .split(",")
        .map(Number)
        .filter((n: number) => !isNaN(n));

    let psIds: number[] = [];
    if (policeStationId)
      psIds = policeStationId
        .split(",")
        .map(Number)
        .filter((n: number) => !isNaN(n));

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let whereClause = isUnauthorized ? sql`FALSE` : sql`TRUE`;

    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      whereClause = sql`${whereClause} AND "return_data"."circle_id" IN (${idList(allowedCircleIds)})`;
    }
    if (psIds.length > 0) {
      whereClause = sql`${whereClause} AND "bin_data"."police_station_id" IN (${idList(psIds)})`;
    }
    if (fromDate) {
      whereClause = sql`${whereClause} AND "return_data"."tax_period" >= ${monthStartTs(fromDate)}`;
    }
    if (toDate) {
      whereClause = sql`${whereClause} AND ${monthBefore('"return_data"."tax_period"', toDate)}`;
    }
    if (search) {
      whereClause = sql`${whereClause} AND ("return_data"."bin" ILIKE ${"%" + search + "%"} OR "bin_data"."entity_name" ILIKE ${"%" + search + "%"})`;
    }

    const rows = extractRows(
      await db.execute(sql`
        SELECT "return_data"."id", "return_data"."bin", "return_data"."tax_period",
               "bin_data"."entity_name" AS "entityName",
               "bin_data"."address",
               "circles"."name" AS "circleName",
               "police_stations"."name" AS "policeStation",
               (count(*) OVER())::int AS "totalCount"
        FROM "return_data"
        INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
        LEFT JOIN "circles" ON "return_data"."circle_id" = "circles"."id"
        LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
        WHERE ${whereClause}
        ORDER BY "return_data"."tax_period" DESC, "return_data"."id" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `)
    );

    let total = rows.length > 0 ? Number(rows[0].totalCount) || 0 : undefined;
    if (total === undefined) {
      const countResult = extractRows(
        await db.execute(sql`
          SELECT (count(*))::int AS "cnt"
          FROM "return_data"
          INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
          WHERE ${whereClause}
        `)
      );
      total = Number(countResult[0]?.cnt) || 0;
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

    const data = rows.map((r: any) => {
      let taxPeriodStr = "";
      if (r.tax_period) {
        const d = new Date(r.tax_period);
        taxPeriodStr = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
      return {
        id: r.id,
        bin: r.bin,
        entityName: r.entityName || r.entity_name,
        address: r.address,
        circleName: r.circleName || r.circle_name,
        policeStation: r.policeStation || r.police_station,
        taxPeriodStr
      };
    });

    return c.json({ data, total, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error("List Error:", error);
    return c.json({ error: "Failed to fetch list" }, 500);
  }
};

/**
 * Why: Typeahead for entity search.
 * When: A user types into the search-by-BIN box.
 * Where: GET /return-data-analyser/search-options.
 * How: Previously loaded every BIN in scope (up to 10k rows + a second query
 *      per 5k) on page load. Now it filters server-side and returns a bounded
 *      page of matches; `q`/`search` narrow by BIN or entity name.
 */
export const searchOptions: Handler = async (c: any) => {
  try {
    const user = c.get("auth");
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    if (approvedCircleIds !== null && approvedCircleIds.length === 0) {
      return c.json({ data: [] });
    }

    const term = (c.req.query("q") || c.req.query("search") || "").trim();
    const requested = parseInt(c.req.query("limit") || "", 10);
    const limitNum = !isNaN(requested) && requested > 0 ? Math.min(requested, 200) : 100;

    const scope =
      approvedCircleIds !== null && approvedCircleIds.length > 0
        ? sql`AND "return_data"."circle_id" IN (${idList(approvedCircleIds)})`
        : sql``;
    const searchFilter = term
      ? sql`AND ("bin_data"."bin" ILIKE ${"%" + term + "%"} OR "bin_data"."entity_name" ILIKE ${"%" + term + "%"})`
      : sql``;

    const data = extractRows(
      await db.execute(sql`
        SELECT DISTINCT "bin_data"."bin", "bin_data"."entity_name" AS "entityName",
               "bin_data"."address", "bin_data"."email", "bin_data"."mobile"
        FROM "bin_data"
        INNER JOIN "return_data" ON "return_data"."bin" = "bin_data"."bin"
        WHERE TRUE ${scope} ${searchFilter}
        ORDER BY "bin_data"."bin"
        LIMIT ${limitNum}
      `)
    );

    return c.json({ data });
  } catch (error) {
    console.error("Search Options Error:", error);
    return c.json({ error: "Failed to fetch search options" }, 500);
  }
};
