import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { sql } from "drizzle-orm";
import {
  getUserApprovedCircleIds,
  resolveAllowedCircleIds,
  extractRows,
  parseAreaParam,
  computeCompliance,
  getDueCutoff,
  monthRange,
  areaOverlap
} from "../utils/helpers.js";

export const drilldownEntities: Handler = async (c: any) => {
  const user = c.get("auth");
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  const circleId = c.req.query("circleId");
  const policeStationId = c.req.query("policeStationId");
  const majorArea = c.req.query("majorArea");
  const mfgArea = c.req.query("mfgArea");
  const serviceArea = c.req.query("serviceArea");
  const classificationType = c.req.query("classificationType") || "activity";
  const categoryValue = c.req.query("categoryValue");

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
    const majorAreas = parseAreaParam(majorArea);
    const mfgAreas = parseAreaParam(mfgArea);
    const serviceAreas = parseAreaParam(serviceArea);

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let baseFilterClause = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      baseFilterClause = sql`${baseFilterClause} AND "return_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      baseFilterClause = sql`${baseFilterClause} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }

    if (fromDate && toDate) {
      // Half-open range on the bare column so the (tax_period) index is usable.
      baseFilterClause = sql`${baseFilterClause} AND ${monthRange('"return_data"."tax_period"', fromDate, toDate)}`;
    }

    // Category Value filtering
    if (classificationType === "activity") {
      if (categoryValue && categoryValue.toLowerCase().includes("yes")) {
        baseFilterClause = sql`${baseFilterClause} AND "return_data"."has_activities" = 'Yes'`;
      } else if (categoryValue && categoryValue.toLowerCase().includes("no")) {
        baseFilterClause = sql`${baseFilterClause} AND ("return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL)`;
      }
    } else if (classificationType === "registration") {
      if (categoryValue && categoryValue.toLowerCase().includes("yes")) {
        baseFilterClause = sql`${baseFilterClause} AND "bin_data"."forced_registration" = 'Yes'`;
      } else if (categoryValue && categoryValue.toLowerCase().includes("no")) {
        baseFilterClause = sql`${baseFilterClause} AND ("bin_data"."forced_registration" IS NULL OR "bin_data"."forced_registration" != 'Yes')`;
      }
    }

    // Area filters on top of base filter. Normalized arrays + GIN overlap keep
    // the multi-select exact and index-backed (the old ILIKE OR-chain was a
    // sequential scan and matched substrings, e.g. "Trading" inside "TradingXyz").
    const filterClause = sql`${baseFilterClause} AND ${areaOverlap('"bin_data"."major_areas"', majorAreas)} AND ${areaOverlap('"bin_data"."manufacturing_areas"', mfgAreas)} AND ${areaOverlap('"bin_data"."service_areas"', serviceAreas)}`;

    // 1. Fetch filtered entities
    const query = sql`
      SELECT 
        "return_data"."bin",
        COALESCE("bin_data"."entity_name", 'Unknown Entity') as "entityName",
        COALESCE("bin_data"."address", 'N/A') as "address",
        COALESCE("bin_data"."hq_address", '') as "hqAddress",
        COALESCE("bin_data"."major_area", 'N/A') as "majorArea",
        COALESCE("bin_data"."manufacturing_area", 'None') as "mfgArea",
        COALESCE("bin_data"."service_area", 'None') as "serviceArea",
        COALESCE("bin_data"."mobile", 'N/A') as "mobile",
        COALESCE("bin_data"."email", 'N/A') as "email",
        COALESCE("bin_data"."forced_registration", 'No') as "forcedRegistration",
        to_char("bin_data"."bin_issue_date", 'YYYY-MM-DD') as "binIssueDate",
        COALESCE("circles"."name", 'Unknown Circle') as "circleName",
        COALESCE("police_stations"."name", 'N/A') as "policeStationName",
        COUNT("return_data"."id") as "submissionCount",
        COALESCE(SUM("return_data"."total_sales_value"), 0) as "totalSalesValue",
        COALESCE(SUM("return_data"."total_payable_vat"), 0) as "totalPayableVat",
        COALESCE(SUM("return_data"."total_input_tax_credit_vat"), 0) as "totalRebateVat",
        COALESCE(SUM("return_data"."decreasing_adjustment"), 0) as "totalDecreasingAdjustment",
        COALESCE(SUM("return_data"."net_payable_vat"), 0) as "totalNetPayableVat",
        COALESCE(SUM("return_data"."deposited_vat"), 0) as "totalDepositedVat"
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      LEFT JOIN "circles" ON "return_data"."circle_id" = "circles"."id"
      LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
      WHERE ${filterClause}
      GROUP BY 
        "return_data"."bin",
        "bin_data"."entity_name",
        "bin_data"."address",
        "bin_data"."hq_address",
        "bin_data"."major_area",
        "bin_data"."manufacturing_area",
        "bin_data"."service_area",
        "bin_data"."mobile",
        "bin_data"."email",
        "bin_data"."forced_registration",
        "bin_data"."bin_issue_date",
        "circles"."name",
        "police_stations"."name"
      ORDER BY "totalPayableVat" DESC, "submissionCount" DESC
      LIMIT 1000
    `;

    const rawRows = extractRows(await db.execute(query));
    const entities = rawRows.map((r: any) => ({
      bin: r.bin,
      entityName: r.entityName,
      address: r.address,
      hqAddress: r.hqAddress,
      majorArea: r.majorArea,
      mfgArea: r.mfgArea,
      serviceArea: r.serviceArea,
      mobile: r.mobile,
      email: r.email,
      forcedRegistration: r.forcedRegistration,
      binIssueDate: r.binIssueDate || "N/A",
      circleName: r.circleName,
      policeStationName: r.policeStationName,
      submissionCount: Number(r.submissionCount) || 0,
      totalSalesValue: Number(r.totalSalesValue) || 0,
      totalPayableVat: Number(r.totalPayableVat) || 0,
      totalRebateVat: Number(r.totalRebateVat) || 0,
      totalDecreasingAdjustment: Number(r.totalDecreasingAdjustment) || 0,
      totalNetPayableVat: Number(r.totalNetPayableVat) || 0,
      totalDepositedVat: Number(r.totalDepositedVat) || 0
    }));

    // 2. Fetch available area options strictly belonging to the institutions in this drilldown context
    const areasQuery = sql`
      SELECT DISTINCT
        "bin_data"."major_areas" as "majors",
        "bin_data"."manufacturing_areas" as "mfgs",
        "bin_data"."service_areas" as "services"
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${baseFilterClause}
        AND (
          "bin_data"."major_areas" IS NOT NULL
          OR "bin_data"."manufacturing_areas" IS NOT NULL
          OR "bin_data"."service_areas" IS NOT NULL
        )
    `;
    const areaRows = extractRows(await db.execute(areasQuery));
    const majorSet = new Set<string>();
    const mfgSet = new Set<string>();
    const serviceSet = new Set<string>();
    const expandedDrilldownRelations: { major: string; mfg: string | null; service: string | null }[] = [];
    const drilldownRelKeySet = new Set<string>();

    for (const r of areaRows) {
      // The `*_areas` columns are already normalized tokens (semicolon-split,
      // trimmed, without None/N/A), so no client-side parsing is needed.
      const majors: string[] = Array.isArray(r.majors) ? r.majors : [];
      const mfgs: string[] = Array.isArray(r.mfgs) ? r.mfgs : [];
      const services: string[] = Array.isArray(r.services) ? r.services : [];

      majors.forEach((s) => majorSet.add(s));
      mfgs.forEach((s) => mfgSet.add(s));
      services.forEach((s) => serviceSet.add(s));

      for (const maj of majors) {
        if (mfgs.length > 0) {
          for (const m of mfgs) {
            const key = `${maj}|mfg|${m}`;
            if (!drilldownRelKeySet.has(key)) {
              drilldownRelKeySet.add(key);
              expandedDrilldownRelations.push({ major: maj, mfg: m, service: null });
            }
          }
        }
        if (services.length > 0) {
          for (const s of services) {
            const key = `${maj}|srv|${s}`;
            if (!drilldownRelKeySet.has(key)) {
              drilldownRelKeySet.add(key);
              expandedDrilldownRelations.push({ major: maj, mfg: null, service: s });
            }
          }
        }
        if (mfgs.length === 0 && services.length === 0) {
          const key = `${maj}|none`;
          if (!drilldownRelKeySet.has(key)) {
            drilldownRelKeySet.add(key);
            expandedDrilldownRelations.push({ major: maj, mfg: null, service: null });
          }
        }
      }
    }

    return c.json({
      data: entities,
      areaOptions: {
        majorAreas: Array.from(majorSet).sort(),
        mfgAreas: Array.from(mfgSet).sort(),
        serviceAreas: Array.from(serviceSet).sort(),
        areaRelations: expandedDrilldownRelations
      }
    });
  } catch (error) {
    console.error("Drilldown Entities Error:", error);
    return c.json({ error: "Failed to fetch drilldown entities" }, 500);
  }
};

export const entityTrends: Handler = async (c: any) => {
  const bin = c.req.query("bin");
  if (!bin) {
    return c.json({ error: "BIN parameter is required" }, 400);
  }

  try {
    const user = c.get("auth");
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    if (approvedCircleIds !== null && approvedCircleIds.length === 0) {
      return c.json({ error: "Forbidden: no approved offices" }, 403);
    }
    const circleScope = approvedCircleIds
      ? sql`AND "bin_data"."circle_id" IN (${sql.join(approvedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`
      : sql``;

    // 1. Fetch entity master details
    const masterQuery = sql`
      SELECT 
        "bin_data"."bin",
        COALESCE("bin_data"."entity_name", 'Unknown Entity') as "entityName",
        COALESCE("bin_data"."address", 'N/A') as "address",
        COALESCE("bin_data"."hq_address", '') as "hqAddress",
        COALESCE("bin_data"."major_area", 'N/A') as "majorArea",
        COALESCE("bin_data"."manufacturing_area", 'None') as "mfgArea",
        COALESCE("bin_data"."service_area", 'None') as "serviceArea",
        COALESCE("bin_data"."mobile", 'N/A') as "mobile",
        COALESCE("bin_data"."email", 'N/A') as "email",
        COALESCE("bin_data"."forced_registration", 'No') as "forcedRegistration",
        to_char("bin_data"."bin_issue_date", 'YYYY-MM-DD') as "binIssueDate",
        COALESCE("circles"."name", 'Unknown Circle') as "circleName",
        COALESCE("police_stations"."name", 'N/A') as "policeStationName"
      FROM "bin_data"
      LEFT JOIN "circles" ON "bin_data"."circle_id" = "circles"."id"
      LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
      WHERE "bin_data"."bin" = ${bin}
      ${circleScope}
      LIMIT 1
    `;
    const masterRows = extractRows(await db.execute(masterQuery));
    if (approvedCircleIds !== null && masterRows.length === 0) {
      return c.json({ error: "Forbidden: entity is outside your approved offices" }, 403);
    }
    let entityInfo = masterRows[0];
    if (!entityInfo) {
      entityInfo = {
        bin,
        entityName: "BIN: " + bin,
        address: "N/A",
        hqAddress: "",
        majorArea: "N/A",
        mfgArea: "None",
        serviceArea: "None",
        mobile: "N/A",
        email: "N/A",
        forcedRegistration: "No",
        binIssueDate: "N/A",
        circleName: "N/A",
        policeStationName: "N/A"
      };
    }

    // 2. Fetch all return records for this BIN ordered by tax_period ASC
    const returnsQuery = sql`
      SELECT 
        "return_data"."id",
        to_char("return_data"."tax_period", 'YYYY-MM') as "period",
        to_char("return_data"."tax_period", 'Mon YYYY') as "periodLabel",
        "return_data"."has_activities" as "hasActivities",
        COALESCE("return_data"."total_sales_value", 0) as "totalSalesValue",
        COALESCE("return_data"."total_payable_vat", 0) as "totalPayableVat",
        COALESCE("return_data"."total_input_tax_credit_vat", 0) as "totalInputTaxCreditVat",
        COALESCE("return_data"."decreasing_adjustment", 0) as "decreasingAdjustment",
        COALESCE("return_data"."increasing_adjustment", 0) as "increasingAdjustment",
        COALESCE("return_data"."net_payable_vat", 0) as "netPayableVat",
        COALESCE("return_data"."deposited_vat", 0) as "depositedVat",
        COALESCE("return_data"."closing_balance_vat", 0) as "closingBalanceVat",
        "return_data"."submission_date" as "submissionDate"
      FROM "return_data"
      WHERE "return_data"."bin" = ${bin}
      ORDER BY "return_data"."tax_period" ASC
    `;
    const returnRows = extractRows(await db.execute(returnsQuery));

    const monthly = returnRows.map((r: any) => {
      let fy = "Unknown";
      if (r.period) {
        const [yrStr, moStr] = r.period.split("-");
        const y = parseInt(yrStr);
        const m = parseInt(moStr);
        if (!isNaN(y) && !isNaN(m)) {
          const fyStart = m >= 7 ? y : y - 1;
          fy = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
        }
      }
      return {
        id: r.id,
        period: r.period,
        periodLabel: r.periodLabel || r.period,
        fiscalYear: fy,
        hasActivities: r.hasActivities || "No",
        totalSalesValue: Number(r.totalSalesValue) || 0,
        totalPayableVat: Number(r.totalPayableVat) || 0,
        totalInputTaxCreditVat: Number(r.totalInputTaxCreditVat) || 0,
        decreasingAdjustment: Number(r.decreasingAdjustment) || 0,
        increasingAdjustment: Number(r.increasingAdjustment) || 0,
        netPayableVat: Number(r.netPayableVat) || 0,
        depositedVat: Number(r.depositedVat) || 0,
        closingBalanceVat: Number(r.closingBalanceVat) || 0,
        submissionDate: r.submissionDate || "N/A"
      };
    });

    // Group by Fiscal Year for yearly trends
    const yearlyMap: Record<string, any> = {};
    for (const m of monthly) {
      const fy = m.fiscalYear || "Unknown";
      if (!yearlyMap[fy]) {
        yearlyMap[fy] = {
          fiscalYear: fy,
          periodLabel: `FY ${fy}`,
          submissionCount: 0,
          totalSalesValue: 0,
          totalPayableVat: 0,
          totalInputTaxCreditVat: 0,
          decreasingAdjustment: 0,
          increasingAdjustment: 0,
          netPayableVat: 0,
          depositedVat: 0,
          closingBalanceVat: 0
        };
      }
      yearlyMap[fy].submissionCount += 1;
      yearlyMap[fy].totalSalesValue += m.totalSalesValue;
      yearlyMap[fy].totalPayableVat += m.totalPayableVat;
      yearlyMap[fy].totalInputTaxCreditVat += m.totalInputTaxCreditVat;
      yearlyMap[fy].decreasingAdjustment += m.decreasingAdjustment;
      yearlyMap[fy].increasingAdjustment += m.increasingAdjustment;
      yearlyMap[fy].netPayableVat += m.netPayableVat;
      yearlyMap[fy].depositedVat += m.depositedVat;
      yearlyMap[fy].closingBalanceVat = m.closingBalanceVat;
    }
    const yearly = Object.values(yearlyMap);

    // 3. Compute Compliance / Filing Statistics (shared, deadline-aware helper)
    const maxPeriodQuery = sql`SELECT to_char(MAX("tax_period"), 'YYYY-MM') as max_period FROM "return_data"`;
    const maxPeriodRows = extractRows(await db.execute(maxPeriodQuery));
    const latestDataPeriod = maxPeriodRows[0]?.max_period || "";
    const dueCutoff = getDueCutoff(latestDataPeriod);

    const compliance = computeCompliance({
      binIssueDate: entityInfo.binIssueDate,
      periods: returnRows.map((r: any) => ({ period: r.period, hasActivities: r.hasActivities })),
      lastDuePeriod: dueCutoff
    });

    return c.json({
      data: {
        entity: entityInfo,
        compliance,
        monthly,
        yearly
      }
    });
  } catch (error) {
    console.error("Entity Trends Error:", error);
    return c.json({ error: "Failed to fetch entity trends" }, 500);
  }
};

export const entityDetailsReport: Handler = async (c: any) => {
  const bin = c.req.query("bin");
  if (!bin) {
    return c.json({ error: "BIN parameter is required" }, 400);
  }

  try {
    const user = c.get("auth");
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    if (approvedCircleIds !== null && approvedCircleIds.length === 0) {
      return c.json({ error: "Forbidden: no approved offices" }, 403);
    }
    const circleScope = approvedCircleIds
      ? sql`AND "bin_data"."circle_id" IN (${sql.join(approvedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`
      : sql``;

    // 1. Fetch Entity Profile
    const masterQuery = sql`
      SELECT 
        "bin_data"."bin",
        COALESCE("bin_data"."entity_name", 'Unknown Entity') as "entityName",
        COALESCE("bin_data"."address", 'N/A') as "address",
        COALESCE("bin_data"."hq_address", '') as "hqAddress",
        COALESCE("bin_data"."major_area", 'N/A') as "majorArea",
        COALESCE("bin_data"."manufacturing_area", 'None') as "mfgArea",
        COALESCE("bin_data"."service_area", 'None') as "serviceArea",
        COALESCE("bin_data"."mobile", 'N/A') as "mobile",
        COALESCE("bin_data"."email", 'N/A') as "email",
        COALESCE("bin_data"."forced_registration", 'No') as "forcedRegistration",
        to_char("bin_data"."bin_issue_date", 'YYYY-MM-DD') as "binIssueDate",
        COALESCE("circles"."name", 'Unknown Circle') as "circleName",
        COALESCE("divisions"."name", 'Unknown Division') as "divisionName",
        COALESCE("police_stations"."name", 'N/A') as "policeStationName"
      FROM "bin_data"
      LEFT JOIN "circles" ON "bin_data"."circle_id" = "circles"."id"
      LEFT JOIN "divisions" ON "circles"."division_id" = "divisions"."id"
      LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
      WHERE "bin_data"."bin" = ${bin}
      ${circleScope}
      LIMIT 1
    `;
    const masterRows = extractRows(await db.execute(masterQuery));
    if (approvedCircleIds !== null && masterRows.length === 0) {
      return c.json({ error: "Forbidden: entity is outside your approved offices" }, 403);
    }
    let entityInfo = masterRows[0] || {
      bin,
      entityName: "BIN: " + bin,
      address: "N/A",
      hqAddress: "",
      majorArea: "N/A",
      mfgArea: "None",
      serviceArea: "None",
      mobile: "N/A",
      email: "N/A",
      forcedRegistration: "No",
      binIssueDate: "N/A",
      circleName: "N/A",
      divisionName: "N/A",
      policeStationName: "N/A"
    };

    // 2. Fetch all return records for this BIN ordered by tax_period ASC
    const returnsQuery = sql`
      SELECT 
        "return_data"."id",
        to_char("return_data"."tax_period", 'YYYY-MM') as "period",
        to_char("return_data"."tax_period", 'Mon YYYY') as "periodLabel",
        to_char("return_data"."tax_period", 'Month') as "monthName",
        "return_data"."has_activities" as "hasActivities",
        COALESCE("return_data"."total_sales_value", 0) as "totalSalesValue",
        COALESCE("return_data"."total_payable_vat", 0) as "totalPayableVat",
        COALESCE("return_data"."total_payable_sd", 0) as "totalPayableSd",
        COALESCE("return_data"."total_input_tax_credit_value", 0) as "totalInputTaxValue",
        COALESCE("return_data"."total_input_tax_credit_vat", 0) as "totalInputTaxCreditVat",
        COALESCE("return_data"."increasing_adjustment", 0) as "increasingAdjustment",
        COALESCE("return_data"."decreasing_adjustment", 0) as "decreasingAdjustment",
        COALESCE("return_data"."vds_increasing", 0) as "vdsIncreasing",
        COALESCE("return_data"."vds_decreasing", 0) as "vdsDecreasing",
        COALESCE("return_data"."advanced_tax_paid", 0) as "advancedTaxPaid",
        COALESCE("return_data"."fine_penalty", 0) as "finePenalty",
        COALESCE("return_data"."net_payable_vat", 0) as "netPayableVat",
        COALESCE("return_data"."net_payable_sd", 0) as "netPayableSd",
        COALESCE("return_data"."deposited_vat", 0) as "depositedVat",
        COALESCE("return_data"."deposited_sd", 0) as "depositedSd",
        COALESCE("return_data"."closing_balance_vat", 0) as "closingBalanceVat",
        COALESCE("return_data"."closing_balance_sd", 0) as "closingBalanceSd",
        "return_data"."submission_date" as "submissionDate",
        "return_data"."submission_id" as "submissionId"
      FROM "return_data"
      WHERE "return_data"."bin" = ${bin}
      ORDER BY "return_data"."tax_period" ASC
    `;
    const returnRows = extractRows(await db.execute(returnsQuery));
    const returnsByPeriod = new Map<string, any>();
    for (const r of returnRows) {
      if (r.period) {
        returnsByPeriod.set(r.period, r);
      }
    }

    // 3. Determine the deadline-aware "as of" period and the 5 fiscal years
    const maxPeriodQuery = sql`SELECT to_char(MAX("tax_period"), 'YYYY-MM') as max_period FROM "return_data"`;
    const maxPeriodRows = extractRows(await db.execute(maxPeriodQuery));
    const latestDataPeriod = maxPeriodRows[0]?.max_period || "";
    const dueCutoff = getDueCutoff(latestDataPeriod);
    const [latestYr, latestMo] = dueCutoff.split("-").map(Number);

    const currentFyEndYear = latestMo >= 7 ? latestYr + 1 : latestYr;
    const fiscalYears: { key: string; label: string; startYear: number; endYear: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const endY = currentFyEndYear - i;
      const startY = endY - 1;
      fiscalYears.push({
        key: `${startY}-${endY.toString().slice(-2)}`,
        label: `FY ${startY}-${endY.toString().slice(-2)}`,
        startYear: startY,
        endYear: endY
      });
    }

    const monthConfigs = [
      { num: 7, name: "July", offsetYear: 0 },
      { num: 8, name: "August", offsetYear: 0 },
      { num: 9, name: "September", offsetYear: 0 },
      { num: 10, name: "October", offsetYear: 0 },
      { num: 11, name: "November", offsetYear: 0 },
      { num: 12, name: "December", offsetYear: 0 },
      { num: 1, name: "January", offsetYear: 1 },
      { num: 2, name: "February", offsetYear: 1 },
      { num: 3, name: "March", offsetYear: 1 },
      { num: 4, name: "April", offsetYear: 1 },
      { num: 5, name: "May", offsetYear: 1 },
      { num: 6, name: "June", offsetYear: 1 }
    ];

    let runningClosingBalanceVat = 0;
    let runningClosingBalanceSd = 0;
    const discrepancies: any[] = [];
    const fullGrid: any[] = [];
    let sl = 1;

    let grandTotal = {
      totalSalesValue: 0,
      totalPayableVat: 0,
      totalPayableSd: 0,
      totalInputTaxValue: 0,
      totalInputTaxCreditVat: 0,
      increasingAdjustment: 0,
      decreasingAdjustment: 0,
      vdsIncreasing: 0,
      vdsDecreasing: 0,
      advancedTaxPaid: 0,
      finePenalty: 0,
      totalAdjustments: 0,
      netPayableVat: 0,
      depositedVat: 0,
      closingBalanceVat: 0,
      netPayableSd: 0,
      depositedSd: 0,
      closingBalanceSd: 0
    };

    for (const fy of fiscalYears) {
      const fyMonths: any[] = [];
      const fySubtotal = {
        totalSalesValue: 0,
        totalPayableVat: 0,
        totalPayableSd: 0,
        totalInputTaxValue: 0,
        totalInputTaxCreditVat: 0,
        increasingAdjustment: 0,
        decreasingAdjustment: 0,
        vdsIncreasing: 0,
        vdsDecreasing: 0,
        advancedTaxPaid: 0,
        finePenalty: 0,
        totalAdjustments: 0,
        netPayableVat: 0,
        depositedVat: 0,
        closingBalanceVat: 0,
        netPayableSd: 0,
        depositedSd: 0,
        closingBalanceSd: 0
      };

      for (const mc of monthConfigs) {
        const calYear = fy.startYear + mc.offsetYear;
        const periodKey = `${calYear}-${String(mc.num).padStart(2, "0")}`;
        const isFuture = periodKey > dueCutoff;
        const r = returnsByPeriod.get(periodKey);

        let isRegistered = true;
        if (entityInfo.binIssueDate && entityInfo.binIssueDate !== "N/A") {
          const [issueY, issueM] = entityInfo.binIssueDate.split("-").map(Number);
          if (calYear < issueY || (calYear === issueY && mc.num < issueM)) {
            isRegistered = false;
          }
        }

        const prevClosingVat = runningClosingBalanceVat;
        const prevClosingSd = runningClosingBalanceSd;

        if (r) {
          const sales = Number(r.totalSalesValue) || 0;
          const payableVat = Number(r.totalPayableVat) || 0;
          const payableSd = Number(r.totalPayableSd) || 0;
          const inputVal = Number(r.totalInputTaxValue) || 0;
          const itcVat = Number(r.totalInputTaxCreditVat) || 0;
          const incAdj = Number(r.increasingAdjustment) || 0;
          const decAdj = Number(r.decreasingAdjustment) || 0;
          const vdsInc = Number(r.vdsIncreasing) || 0;
          const vdsDec = Number(r.vdsDecreasing) || 0;
          const advTax = Number(r.advancedTaxPaid) || 0;
          const penalty = Number(r.finePenalty) || 0;
          const totalAdj = incAdj + vdsInc - (decAdj + vdsDec + advTax);
          const netVat = Number(r.netPayableVat) || 0;
          const depVat = Number(r.depositedVat) || 0;
          const closingVat = Number(r.closingBalanceVat) || 0;
          const netSd = Number(r.netPayableSd) || 0;
          const depSd = Number(r.depositedSd) || 0;
          const closingSd = Number(r.closingBalanceSd) || 0;

          // Update running balances
          runningClosingBalanceVat = closingVat;
          runningClosingBalanceSd = closingSd;

          // Shortfall Analysis with Previous Closing Balance offset
          const requiredVat = Math.max(0, netVat - prevClosingVat);
          const shortfallVat = Math.max(0, requiredVat - depVat);

          const requiredSd = Math.max(0, netSd - prevClosingSd);
          const shortfallSd = Math.max(0, requiredSd - depSd);

          if (shortfallVat > 0) {
            discrepancies.push({
              type: "VAT Treasury Shortfall",
              period: `${mc.name} ${calYear}`,
              description: `Net Payable VAT is ${netVat.toLocaleString()}, Previous Closing Balance was ${prevClosingVat.toLocaleString()} (Required: ${requiredVat.toLocaleString()}), but Deposited VAT was ${depVat.toLocaleString()}. Shortfall: ${shortfallVat.toLocaleString()}`
            });
          }

          if (shortfallSd > 0) {
            discrepancies.push({
              type: "SD Treasury Shortfall",
              period: `${mc.name} ${calYear}`,
              description: `Net Payable SD is ${netSd.toLocaleString()}, Previous Closing Balance SD was ${prevClosingSd.toLocaleString()} (Required: ${requiredSd.toLocaleString()}), but Deposited SD was ${depSd.toLocaleString()}. Shortfall: ${shortfallSd.toLocaleString()}`
            });
          }

          if (r.hasActivities === "No" && sales > 0) {
            discrepancies.push({
              type: "Activity Status Inconsistency",
              period: `${mc.name} ${calYear}`,
              description: `Return marked as 'No Activity' but Sales Value is ${sales.toLocaleString()}`
            });
          }

          // Accumulate subtotals
          fySubtotal.totalSalesValue += sales;
          fySubtotal.totalPayableVat += payableVat;
          fySubtotal.totalPayableSd += payableSd;
          fySubtotal.totalInputTaxValue += inputVal;
          fySubtotal.totalInputTaxCreditVat += itcVat;
          fySubtotal.increasingAdjustment += incAdj;
          fySubtotal.decreasingAdjustment += decAdj;
          fySubtotal.vdsIncreasing += vdsInc;
          fySubtotal.vdsDecreasing += vdsDec;
          fySubtotal.advancedTaxPaid += advTax;
          fySubtotal.finePenalty += penalty;
          fySubtotal.totalAdjustments += totalAdj;
          fySubtotal.netPayableVat += netVat;
          fySubtotal.depositedVat += depVat;
          fySubtotal.closingBalanceVat = closingVat;
          fySubtotal.netPayableSd += netSd;
          fySubtotal.depositedSd += depSd;
          fySubtotal.closingBalanceSd = closingSd;

          fyMonths.push({
            sl: sl++,
            period: periodKey,
            monthName: mc.name,
            year: calYear,
            periodLabel: `${mc.name.slice(0, 3)} ${calYear}`,
            hasData: true,
            isFuture: false,
            isRegistered: true,
            hasActivities: r.hasActivities || "No",
            totalSalesValue: sales,
            totalPayableVat: payableVat,
            totalPayableSd: payableSd,
            totalInputTaxValue: inputVal,
            totalInputTaxCreditVat: itcVat,
            increasingAdjustment: incAdj,
            decreasingAdjustment: decAdj,
            vdsIncreasing: vdsInc,
            vdsDecreasing: vdsDec,
            advancedTaxPaid: advTax,
            finePenalty: penalty,
            totalAdjustments: totalAdj,
            netPayableVat: netVat,
            depositedVat: depVat,
            closingBalanceVat: closingVat,
            netPayableSd: netSd,
            depositedSd: depSd,
            closingBalanceSd: closingSd,
            submissionDate: r.submissionDate || "N/A",
            submissionId: r.submissionId || "N/A"
          });
        } else {
          // Missing or Future Month
          if (!isFuture && isRegistered) {
            discrepancies.push({
              type: "Non-Filed Return",
              period: `${mc.name} ${calYear}`,
              description: `Return for ${mc.name} ${calYear} has not been filed.`
            });
          }

          fyMonths.push({
            sl: sl++,
            period: periodKey,
            monthName: mc.name,
            year: calYear,
            periodLabel: `${mc.name.slice(0, 3)} ${calYear}`,
            hasData: false,
            isFuture,
            isRegistered,
            hasActivities: "-",
            totalSalesValue: null,
            totalPayableVat: null,
            totalPayableSd: null,
            totalInputTaxValue: null,
            totalInputTaxCreditVat: null,
            increasingAdjustment: null,
            decreasingAdjustment: null,
            vdsIncreasing: null,
            vdsDecreasing: null,
            advancedTaxPaid: null,
            finePenalty: null,
            totalAdjustments: null,
            netPayableVat: null,
            depositedVat: null,
            closingBalanceVat: null,
            netPayableSd: null,
            depositedSd: null,
            closingBalanceSd: null,
            submissionDate: "-",
            submissionId: "-"
          });
        }
      }

      // Grand totals accumulator
      grandTotal.totalSalesValue += fySubtotal.totalSalesValue;
      grandTotal.totalPayableVat += fySubtotal.totalPayableVat;
      grandTotal.totalPayableSd += fySubtotal.totalPayableSd;
      grandTotal.totalInputTaxValue += fySubtotal.totalInputTaxValue;
      grandTotal.totalInputTaxCreditVat += fySubtotal.totalInputTaxCreditVat;
      grandTotal.increasingAdjustment += fySubtotal.increasingAdjustment;
      grandTotal.decreasingAdjustment += fySubtotal.decreasingAdjustment;
      grandTotal.vdsIncreasing += fySubtotal.vdsIncreasing;
      grandTotal.vdsDecreasing += fySubtotal.vdsDecreasing;
      grandTotal.advancedTaxPaid += fySubtotal.advancedTaxPaid;
      grandTotal.finePenalty += fySubtotal.finePenalty;
      grandTotal.totalAdjustments += fySubtotal.totalAdjustments;
      grandTotal.netPayableVat += fySubtotal.netPayableVat;
      grandTotal.depositedVat += fySubtotal.depositedVat;
      grandTotal.closingBalanceVat = fySubtotal.closingBalanceVat;
      grandTotal.netPayableSd += fySubtotal.netPayableSd;
      grandTotal.depositedSd += fySubtotal.depositedSd;
      grandTotal.closingBalanceSd = fySubtotal.closingBalanceSd;

      fullGrid.push({
        fiscalYear: fy,
        months: fyMonths,
        subtotal: fySubtotal
      });
    }

    // 4. Compliance Statistics (single source of truth, deadline-aware)
    const compliance = computeCompliance({
      binIssueDate: entityInfo.binIssueDate,
      periods: returnRows.map((r: any) => ({ period: r.period, hasActivities: r.hasActivities })),
      lastDuePeriod: dueCutoff
    });

    return c.json({
      data: {
        entity: entityInfo,
        compliance,
        fiscalYears,
        grid: fullGrid,
        grandTotal,
        discrepancies,
        latestPeriod: dueCutoff
      }
    });
  } catch (error) {
    console.error("Entity Details Report Error:", error);
    return c.json({ error: "Failed to fetch entity details report" }, 500);
  }
};
