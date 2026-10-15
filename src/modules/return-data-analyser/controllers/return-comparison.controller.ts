import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { sql } from "drizzle-orm";
import { binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import {
  getUserApprovedCircleIds,
  resolveAllowedCircleIds,
  extractRows,
  monthRange,
  areaOverlap
} from "../utils/helpers.js";

export const fyComparison: Handler = async (c: any) => {
  const user = c.get("auth");
  const { circleId, policeStationId, fromDate, toDate, fy, forcedRegistration, majorArea, mfgArea, serviceArea } = c.req.query();

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

    let majorAreas: string[] = [];
    if (majorArea)
      majorAreas = majorArea
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

    let mfgAreas: string[] = [];
    if (mfgArea)
      mfgAreas = mfgArea
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

    let serviceAreas: string[] = [];
    if (serviceArea)
      serviceAreas = serviceArea
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

    let currentFyStart: number;
    const fyStr = fy ? "" + fy : "";
    if (fyStr) {
      currentFyStart = parseInt(fyStr.split("-")[0] || "0");
    } else {
      const now = new Date();
      currentFyStart = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
    }
    const previousFyStart = currentFyStart - 1;

    const currentFy = currentFyStart + "-" + (currentFyStart + 1).toString().slice(-2);
    const previousFy = previousFyStart + "-" + (previousFyStart + 1).toString().slice(-2);

    const monthNames = [
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June"
    ];

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let filterClause = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      filterClause = sql`${filterClause} AND "return_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (forcedRegistration === "Yes") {
      filterClause = sql`${filterClause} AND "bin_data"."forced_registration" = 'Yes'`;
    }
    // Normalized activity arrays + GIN overlap (exact multi-select, no substring
    // false-positives and index-backed instead of an un-indexable text equality).
    filterClause = sql`${filterClause} AND ${areaOverlap('"bin_data"."major_areas"', majorAreas)} AND ${areaOverlap('"bin_data"."manufacturing_areas"', mfgAreas)} AND ${areaOverlap('"bin_data"."service_areas"', serviceAreas)}`;

    // bin_data-only scope for the eligible-count query (no return_data join).
    let eligibleFilter = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      eligibleFilter = sql`${eligibleFilter} AND "bin_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      eligibleFilter = sql`${eligibleFilter} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (forcedRegistration === "Yes") {
      eligibleFilter = sql`${eligibleFilter} AND "bin_data"."forced_registration" = 'Yes'`;
    }
    eligibleFilter = sql`${eligibleFilter} AND ${areaOverlap('"bin_data"."major_areas"', majorAreas)} AND ${areaOverlap('"bin_data"."manufacturing_areas"', mfgAreas)} AND ${areaOverlap('"bin_data"."service_areas"', serviceAreas)}`;

    const prevDateStrs: string[] = [];
    const currDateStrs: string[] = [];
    for (let i = 0; i < 12; i++) {
      const prevYear = i < 6 ? previousFyStart : previousFyStart + 1;
      const currYear = i < 6 ? currentFyStart : currentFyStart + 1;
      const monthNum = i < 6 ? 7 + i : i - 5;
      const mm = String(monthNum).padStart(2, "0");
      prevDateStrs.push(prevYear + "-" + mm);
      currDateStrs.push(currYear + "-" + mm);
    }
    const allDateStrs = [...prevDateStrs, ...currDateStrs];

    const allReturns = extractRows(
      await db.execute(sql`
      SELECT 
        to_char("return_data"."tax_period", 'YYYY-MM') as period,
        COUNT(DISTINCT "return_data"."bin") as returns,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN "return_data"."bin" END) as activity_yes,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL THEN "return_data"."bin" END) as activity_no,
        COUNT(DISTINCT CASE WHEN COALESCE("bin_data"."forced_registration", 'N/A') = 'No' OR COALESCE("bin_data"."forced_registration", 'N/A') = 'N/A' THEN "return_data"."bin" END) as forced_no,
        COUNT(DISTINCT CASE WHEN "bin_data"."forced_registration" = 'Yes' THEN "return_data"."bin" END) as forced_yes
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${filterClause}
        AND ${monthRange('"return_data"."tax_period"', allDateStrs[0], allDateStrs[allDateStrs.length - 1])}
      GROUP BY to_char("return_data"."tax_period", 'YYYY-MM')
    `)
    );
    const returnsByPeriod: Record<string, any> = {};
    for (const r of allReturns) returnsByPeriod[r.period as string] = r;

    // One set-based query for every month instead of one round-trip per month.
    const eligibleRows = extractRows(
      await db.execute(sql`
        SELECT ds AS date_str, count(DISTINCT "bin_data"."bin")::int AS cnt
        FROM unnest(ARRAY[${sql.join(
          allDateStrs.map((d) => sql`${d}`),
          sql`, `
        )}]::text[]) AS ds
        LEFT JOIN "bin_data"
          ON "bin_data"."bin_status" NOT IN ('Cancelled', 'Suspended')
         AND ("bin_data"."bin_issue_date" IS NULL OR "bin_data"."bin_issue_date" < (to_date(ds, 'YYYY-MM')::timestamp + interval '1 month'))
         AND ${eligibleFilter}
        GROUP BY ds
      `)
    );
    const eligibleByDate: Record<string, number> = {};
    for (const d of allDateStrs) eligibleByDate[d] = 0;
    for (const r of eligibleRows) eligibleByDate[r.date_str as string] = Number(r.cnt) || 0;

    const targetPeriod = toDate || fromDate || "";
    let reportMonthIndex = -1;
    if (targetPeriod) {
      const tIdx = currDateStrs.findIndex((d) => d === targetPeriod);
      if (tIdx !== -1) reportMonthIndex = tIdx;
      else {
        const pIdx = prevDateStrs.findIndex((d) => d === targetPeriod);
        if (pIdx !== -1) reportMonthIndex = pIdx;
      }
    }
    if (reportMonthIndex === -1) {
      const now = new Date();
      const nowStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      const nIdx = currDateStrs.findIndex((d) => d === nowStr);
      if (nIdx !== -1) reportMonthIndex = nIdx;
    }

    const months: any[] = [];
    for (let i = 0; i < 12; i++) {
      const prevR = returnsByPeriod[prevDateStrs[i]!] || {};
      const currR = returnsByPeriod[currDateStrs[i]!] || {};
      const pReturns = Number(prevR.returns) || 0;
      const cReturns = Number(currR.returns) || 0;
      const prevEligible = eligibleByDate[prevDateStrs[i]!] || 0;
      const currEligible = eligibleByDate[currDateStrs[i]!] || 0;

      months.push({
        monthName: monthNames[i],
        isCurrentReportMonth: i === reportMonthIndex,
        previous: {
          period: prevDateStrs[i],
          returns: pReturns,
          eligible: prevEligible,
          percentage: prevEligible > 0 ? Math.round((pReturns / prevEligible) * 100 * 100) / 100 : 0,
          hasData: pReturns > 0,
          activityYes: Number(prevR.activity_yes) || 0,
          activityNo: Number(prevR.activity_no) || 0,
          forcedNo: Number(prevR.forced_no) || 0,
          forcedYes: Number(prevR.forced_yes) || 0
        },
        current: {
          period: currDateStrs[i],
          returns: cReturns,
          eligible: currEligible,
          percentage: currEligible > 0 ? Math.round((cReturns / currEligible) * 100 * 100) / 100 : 0,
          hasData: cReturns > 0,
          activityYes: Number(currR.activity_yes) || 0,
          activityNo: Number(currR.activity_no) || 0,
          forcedNo: Number(currR.forced_no) || 0,
          forcedYes: Number(currR.forced_yes) || 0
        }
      });
    }

    const totals = {
      previousReturns: 0,
      previousActivityYes: 0,
      previousActivityNo: 0,
      previousForcedNo: 0,
      previousForcedYes: 0,
      currentReturns: 0,
      currentActivityYes: 0,
      currentActivityNo: 0,
      currentForcedNo: 0,
      currentForcedYes: 0
    };
    for (const m of months) {
      if (m.previous.hasData) {
        totals.previousReturns += m.previous.returns;
        totals.previousActivityYes += m.previous.activityYes;
        totals.previousActivityNo += m.previous.activityNo;
        totals.previousForcedNo += m.previous.forcedNo;
        totals.previousForcedYes += m.previous.forcedYes;
      }
      if (m.current.hasData) {
        totals.currentReturns += m.current.returns;
        totals.currentActivityYes += m.current.activityYes;
        totals.currentActivityNo += m.current.activityNo;
        totals.currentForcedNo += m.current.forcedNo;
        totals.currentForcedYes += m.current.forcedYes;
      }
    }

    return c.json({
      data: {
        currentFy,
        previousFy,
        months,
        totals
      }
    });
  } catch (error) {
    console.error("FY Comparison Error:", error);
    return c.json({ error: "Failed to fetch FY comparison data" }, 500);
  }
};

export const yearComparison: Handler = async (c: any) => {
  const user = c.get("auth");
  const { circleId, policeStationId, fromDate, toDate, forcedRegistration, majorArea, mfgArea, serviceArea } = c.req.query();

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

    let majorAreas: string[] = [];
    if (majorArea)
      majorAreas = majorArea
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

    let mfgAreas: string[] = [];
    if (mfgArea)
      mfgAreas = mfgArea
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

    let serviceAreas: string[] = [];
    if (serviceArea)
      serviceAreas = serviceArea
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let filterClause = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      filterClause = sql`${filterClause} AND "return_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (forcedRegistration === "Yes") {
      filterClause = sql`${filterClause} AND "bin_data"."forced_registration" = 'Yes'`;
    }
    // Normalized activity arrays + GIN overlap (exact multi-select, no substring
    // false-positives and index-backed instead of an un-indexable text equality).
    filterClause = sql`${filterClause} AND ${areaOverlap('"bin_data"."major_areas"', majorAreas)} AND ${areaOverlap('"bin_data"."manufacturing_areas"', mfgAreas)} AND ${areaOverlap('"bin_data"."service_areas"', serviceAreas)}`;

    // bin_data-only scope for the eligible-count query (no return_data join).
    let eligibleFilter = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      eligibleFilter = sql`${eligibleFilter} AND "bin_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      eligibleFilter = sql`${eligibleFilter} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (forcedRegistration === "Yes") {
      eligibleFilter = sql`${eligibleFilter} AND "bin_data"."forced_registration" = 'Yes'`;
    }
    eligibleFilter = sql`${eligibleFilter} AND ${areaOverlap('"bin_data"."major_areas"', majorAreas)} AND ${areaOverlap('"bin_data"."manufacturing_areas"', mfgAreas)} AND ${areaOverlap('"bin_data"."service_areas"', serviceAreas)}`;

    const refDate = toDate ? new Date(toDate + "-01") : new Date();
    const targetPeriod = toDate ? toDate : `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
    const monthsList: { year: number; month: number; label: string; dateStr: string; monthName: string }[] = [];
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
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      monthsList.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        monthName: monthNames[d.getMonth()] || "",
        label: monthLabels[d.getMonth()] + " " + d.getFullYear(),
        dateStr: d.getFullYear() + "-" + mm
      });
    }

    let totalSubmissions = 0;
    let totalActivityYes = 0;
    let totalExpectedReturns = 0;
    const months: any[] = [];

    const allDateStrs = monthsList.map((ml) => ml.dateStr);

    const allReturns = extractRows(
      await db.execute(sql`
      SELECT 
        to_char("return_data"."tax_period", 'YYYY-MM') as period,
        COUNT(DISTINCT "return_data"."bin") as submissions,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN "return_data"."bin" END) as activity_yes,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL THEN "return_data"."bin" END) as activity_no,
        COUNT(DISTINCT CASE WHEN COALESCE("bin_data"."forced_registration", 'N/A') = 'No' OR COALESCE("bin_data"."forced_registration", 'N/A') = 'N/A' THEN "return_data"."bin" END) as forced_no,
        COUNT(DISTINCT CASE WHEN "bin_data"."forced_registration" = 'Yes' THEN "return_data"."bin" END) as forced_yes
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${filterClause}
        AND ${monthRange('"return_data"."tax_period"', allDateStrs[0], allDateStrs[allDateStrs.length - 1])}
      GROUP BY to_char("return_data"."tax_period", 'YYYY-MM')
    `)
    );
    const returnsByPeriod: Record<string, any> = {};
    for (const r of allReturns) returnsByPeriod[r.period as string] = r;

    // One set-based query for every month instead of one round-trip per month.
    const eligibleRows = extractRows(
      await db.execute(sql`
        SELECT ds AS date_str, count(DISTINCT "bin_data"."bin")::int AS cnt
        FROM unnest(ARRAY[${sql.join(
          allDateStrs.map((d) => sql`${d}`),
          sql`, `
        )}]::text[]) AS ds
        LEFT JOIN "bin_data"
          ON "bin_data"."bin_status" NOT IN ('Cancelled', 'Suspended')
         AND ("bin_data"."bin_issue_date" IS NULL OR "bin_data"."bin_issue_date" < (to_date(ds, 'YYYY-MM')::timestamp + interval '1 month'))
         AND ${eligibleFilter}
        GROUP BY ds
      `)
    );
    const eligibleByDate: Record<string, number> = {};
    for (const d of allDateStrs) eligibleByDate[d] = 0;
    for (const r of eligibleRows) eligibleByDate[r.date_str as string] = Number(r.cnt) || 0;

    for (const ml of monthsList) {
      const r = returnsByPeriod[ml.dateStr] || {};
      const submissions = Number(r.submissions) || 0;
      const actYes = Number(r.activity_yes) || 0;
      const actNo = Number(r.activity_no) || 0;
      const forcedYes = Number(r.forced_yes) || 0;
      const forcedNo = Number(r.forced_no) || 0;
      const eligible = eligibleByDate[ml.dateStr] || 0;

      totalExpectedReturns += eligible;
      totalSubmissions += submissions;
      totalActivityYes += actYes;

      months.push({
        period: ml.dateStr,
        monthName: ml.monthName,
        monthLabel: ml.label,
        isCurrentMonth: ml.dateStr === targetPeriod,
        hasData: submissions > 0,
        submissions,
        eligible,
        submissionRate: eligible > 0 ? Math.round((submissions / eligible) * 100 * 100) / 100 : 0,
        activityYes: actYes,
        activityNo: actNo,
        forcedYes,
        forcedNo,
        monthlyGrowth: null as number | null
      });
    }

    for (let i = 1; i < months.length; i++) {
      const prevRate = months[i - 1].submissionRate;
      const currRate = months[i].submissionRate;
      if (months[i].hasData && months[i - 1].hasData) {
        months[i].monthlyGrowth = Math.round((currRate - prevRate) * 100) / 100;
      }
    }

    return c.json({
      data: {
        targetPeriod,
        months,
        totalSubmissions,
        totalActivityYes,
        totalExpectedReturns
      }
    });
  } catch (error) {
    console.error("Year Comparison Error:", error);
    return c.json({ error: "Failed to fetch Year comparison data" }, 500);
  }
};
