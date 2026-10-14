import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { and, eq, inArray, sql, isNotNull } from "drizzle-orm";
import { binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import { circles, policeStations } from "@/modules/settings/database/models/settings.js";
import {
  getUserApprovedCircleIds,
  resolveAllowedCircleIds,
  extractRows,
  parseAreaParam
} from "../utils/helpers.js";

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

    const circleWhere =
      approvedCircleIds !== null
        ? and(isNotNull(binData.circleId), inArray(binData.circleId, approvedCircleIds))
        : isNotNull(binData.circleId);

    const psQuery =
      circlesArr.length > 0
        ? db
            .selectDistinct({ policeStation: policeStations.name })
            .from(policeStations)
            .leftJoin(circles, eq(policeStations.circleId, circles.id))
            .where(and(sql`${policeStations.name} IS NOT NULL AND ${policeStations.name} != ''`, inArray(circles.name, circlesArr)))
        : db
            .selectDistinct({ policeStation: policeStations.name })
            .from(policeStations)
            .where(sql`${policeStations.name} IS NOT NULL AND ${policeStations.name} != ''`);

    const [circlesList, policeStationsList, statuses, regTypes, majorAreas, mfgAreas, serviceAreas, areaRelations] = await Promise.all([
      db.selectDistinct({ circle: circles.name }).from(binData).leftJoin(circles, eq(binData.circleId, circles.id)).where(circleWhere),
      psQuery,
      db
        .selectDistinct({ status: binData.binStatus })
        .from(binData)
        .where(sql`${binData.binStatus} IS NOT NULL AND ${binData.binStatus} != ''`),
      db
        .selectDistinct({ regType: binData.forcedRegistration })
        .from(binData)
        .where(sql`${binData.forcedRegistration} IS NOT NULL AND ${binData.forcedRegistration} != ''`),
      db
        .selectDistinct({ major: binData.majorAreaOfEconomicActivity })
        .from(binData)
        .where(sql`${binData.majorAreaOfEconomicActivity} IS NOT NULL AND ${binData.majorAreaOfEconomicActivity} != ''`),
      db
        .selectDistinct({ mfg: binData.areasOfManufacturing })
        .from(binData)
        .where(
          sql`${binData.areasOfManufacturing} IS NOT NULL AND ${binData.areasOfManufacturing} != 'None' AND ${binData.areasOfManufacturing} != ''`
        ),
      db
        .selectDistinct({ service: binData.areasOfService })
        .from(binData)
        .where(sql`${binData.areasOfService} IS NOT NULL AND ${binData.areasOfService} != 'None' AND ${binData.areasOfService} != ''`),
      db
        .selectDistinct({
          major: binData.majorAreaOfEconomicActivity,
          mfg: binData.areasOfManufacturing,
          service: binData.areasOfService
        })
        .from(binData)
        .where(sql`${binData.majorAreaOfEconomicActivity} IS NOT NULL AND ${binData.majorAreaOfEconomicActivity} != ''`)
    ]);

    const distinctMajorSet = new Set<string>();
    for (const m of majorAreas) {
      if (m.major) {
        m.major
          .split(";")
          .map((s: string) => s.trim())
          .filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A")
          .forEach((s: string) => distinctMajorSet.add(s));
      }
    }

    const distinctMfgSet = new Set<string>();
    for (const m of mfgAreas) {
      if (m.mfg) {
        m.mfg
          .split(";")
          .map((s: string) => s.trim())
          .filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A")
          .forEach((s: string) => distinctMfgSet.add(s));
      }
    }

    const distinctServiceSet = new Set<string>();
    for (const s of serviceAreas) {
      if (s.service) {
        s.service
          .split(";")
          .map((str: string) => str.trim())
          .filter((str: string) => Boolean(str) && str !== "None" && str !== "N/A")
          .forEach((str: string) => distinctServiceSet.add(str));
      }
    }

    const expandedAreaRelations: { major: string; mfg: string | null; service: string | null }[] = [];
    const relKeySet = new Set<string>();

    for (const r of areaRelations) {
      const majors = (r.major || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A");
      const mfgs = (r.mfg || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A");
      const services = (r.service || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A");

      for (const maj of majors) {
        if (mfgs.length > 0) {
          for (const m of mfgs) {
            const key = `${maj}|mfg|${m}`;
            if (!relKeySet.has(key)) {
              relKeySet.add(key);
              expandedAreaRelations.push({ major: maj, mfg: m, service: null });
            }
          }
        }
        if (services.length > 0) {
          for (const s of services) {
            const key = `${maj}|srv|${s}`;
            if (!relKeySet.has(key)) {
              relKeySet.add(key);
              expandedAreaRelations.push({ major: maj, mfg: null, service: s });
            }
          }
        }
        if (mfgs.length === 0 && services.length === 0) {
          const key = `${maj}|none`;
          if (!relKeySet.has(key)) {
            relKeySet.add(key);
            expandedAreaRelations.push({ major: maj, mfg: null, service: null });
          }
        }
      }
    }

    return c.json({
      circles: circlesList
        .map((c: any) => c.circle)
        .filter(Boolean)
        .sort(),
      policeStations: policeStationsList
        .map((p: any) => p.policeStation)
        .filter(Boolean)
        .sort(),
      statuses: statuses
        .map((s: any) => s.status)
        .filter(Boolean)
        .sort(),
      regTypes: regTypes
        .map((r: any) => (r.regType === "Yes" ? "Forced" : r.regType === "No" ? "Regular" : r.regType))
        .filter(Boolean)
        .sort(),
      majorAreas: Array.from(distinctMajorSet).sort(),
      mfgAreas: Array.from(distinctMfgSet).sort(),
      serviceAreas: Array.from(distinctServiceSet).sort(),
      areaRelations: expandedAreaRelations
    });
  } catch (error) {
    console.error("Filter Options Error:", error);
    return c.json({ error: "Failed to fetch options" }, 500);
  }
};

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
  if (!fromDateStr || !toDateStr) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    fromDateStr = `${yyyy}-${mm}`;
    toDateStr = `${yyyy}-${mm}`;
  }

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

    let baseFilter = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      baseFilter = sql`${baseFilter} AND "return_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      baseFilter = sql`${baseFilter} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (majorAreas.length > 0) {
      const orParts = majorAreas.map((a: string) => sql`"bin_data"."major_area" ILIKE ${"%" + a + "%"}`);
      baseFilter = sql`${baseFilter} AND (${sql.join(orParts, sql` OR `)})`;
    }
    if (mfgAreas.length > 0) {
      const orParts = mfgAreas.map((a: string) => sql`"bin_data"."manufacturing_area" ILIKE ${"%" + a + "%"}`);
      baseFilter = sql`${baseFilter} AND (${sql.join(orParts, sql` OR `)})`;
    }
    if (serviceAreas.length > 0) {
      const orParts = serviceAreas.map((a: string) => sql`"bin_data"."service_area" ILIKE ${"%" + a + "%"}`);
      baseFilter = sql`${baseFilter} AND (${sql.join(orParts, sql` OR `)})`;
    }

    const dateFilter = sql`${baseFilter} AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date) AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')`;

    const rangeMonths: string[] = [];
    {
      const startD = new Date(fromDateStr + "-01");
      const endD = new Date(toDateStr + "-01");
      let cur = new Date(startD);
      while (cur <= endD) {
        rangeMonths.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    const eligiblePerMonth = await Promise.all(
      rangeMonths.map(async (dateStr) => {
        const res = await db.execute(sql`
        SELECT COUNT(DISTINCT "bin_data"."bin") as cnt FROM "bin_data"
        WHERE "bin_data"."bin_status" NOT IN ('Cancelled', 'Suspended')
          AND ("bin_data"."bin_issue_date" IS NULL OR cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${dateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day'))
        ${
          !isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0
            ? sql`AND "bin_data"."circle_id" IN (${sql.join(
                allowedCircleIds.map((id: number) => sql`${id}`),
                sql`, `
              )})`
            : isUnauthorized
              ? sql`AND 1=0`
              : sql``
        }
        ${
          psIds.length > 0
            ? sql`AND "bin_data"."police_station_id" IN (${sql.join(
                psIds.map((id: number) => sql`${id}`),
                sql`, `
              )})`
            : sql``
        }
        ${
          majorAreas.length > 0
            ? sql`AND "bin_data"."major_area" IN (${sql.join(
                majorAreas.map((a: string) => sql`${a}`),
                sql`, `
              )})`
            : sql``
        }
        ${
          mfgAreas.length > 0
            ? sql`AND "bin_data"."manufacturing_area" IN (${sql.join(
                mfgAreas.map((a: string) => sql`${a}`),
                sql`, `
              )})`
            : sql``
        }
        ${
          serviceAreas.length > 0
            ? sql`AND "bin_data"."service_area" IN (${sql.join(
                serviceAreas.map((a: string) => sql`${a}`),
                sql`, `
              )})`
            : sql``
        }
      `);
        return extractRows(res);
      })
    );
    const totalRegBins = eligiblePerMonth.reduce((sum, r) => sum + (Number(r[0]?.cnt) || 0), 0);

    const totalReturnBinsResult = extractRows(
      await db.execute(sql`
      SELECT COUNT(DISTINCT "return_data"."bin") as cnt
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
    `)
    );
    const totalReturnBins = Number(totalReturnBinsResult[0]?.cnt) || 0;
    const submissionPercentage = totalRegBins > 0 ? Math.round((totalReturnBins / totalRegBins) * 100 * 100) / 100 : 0;

    const byActivityResult = extractRows(
      await db.execute(sql`
      SELECT COALESCE("return_data"."has_activities", 'N/A') as activity, COUNT(DISTINCT "return_data"."bin") as count
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
      GROUP BY activity ORDER BY count DESC
    `)
    );
    const byActivity = byActivityResult.map((r: any) => ({ activity: r.activity, count: Number(r.count) }));

    const byRegistrationResult = extractRows(
      await db.execute(sql`
      SELECT COALESCE("bin_data"."forced_registration", 'N/A') as forced_registration, COUNT(DISTINCT "return_data"."bin") as count
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
      GROUP BY forced_registration ORDER BY count DESC
    `)
    );
    const byRegistration = byRegistrationResult.map((r: any) => ({ forced_registration: r.forced_registration, count: Number(r.count) }));

    const metricsResult = extractRows(
      await db.execute(sql`
      SELECT
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."total_sales_value",0) > 0 AND COALESCE("return_data"."total_payable_vat",0) > 0 THEN "return_data"."bin" END) as metric3,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."total_sales_value",0) > 0 AND COALESCE("return_data"."total_payable_vat",0) = 0 THEN "return_data"."bin" END) as metric4,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."total_payable_sd",0) > 0 THEN "return_data"."bin" END) as metric5,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."total_input_tax_credit_value",0) > 0 THEN "return_data"."bin" END) as metric6,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."increasing_adjustment",0) > 0 THEN "return_data"."bin" END) as metric7,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."decreasing_adjustment",0) > 0 THEN "return_data"."bin" END) as metric8,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."net_payable_vat",0) < 0 THEN "return_data"."bin" END) as metric9,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."net_payable_vat",0) < -100000 THEN "return_data"."bin" END) as metric10,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."net_payable_vat",0) < 0 AND COALESCE("return_data"."deposited_vat",0) > 0 THEN "return_data"."bin" END) as metric11,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."net_payable_vat",0) > 100000 AND COALESCE("return_data"."deposited_vat",0) > 0 THEN "return_data"."bin" END) as metric12,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."net_payable_sd",0) < 0 THEN "return_data"."bin" END) as metric13,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."closing_balance_vat",0) > 0 AND COALESCE("return_data"."closing_balance_vat",0) <= 100000 THEN "return_data"."bin" END) as metric14,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."closing_balance_vat",0) > 100000 AND COALESCE("return_data"."closing_balance_vat",0) <= 500000 THEN "return_data"."bin" END) as metric15,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."closing_balance_vat",0) > 500000 THEN "return_data"."bin" END) as metric16,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."vds_increasing",0) > 0 THEN "return_data"."bin" END) as metric17,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."vds_decreasing",0) > 0 THEN "return_data"."bin" END) as metric18,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."advanced_tax_paid",0) > 0 THEN "return_data"."bin" END) as metric19,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."advanced_tax_paid",0) < COALESCE("return_data"."increasing_adjustment",0) THEN "return_data"."bin" END) as metric20,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."fine_penalty",0) > 0 AND COALESCE("return_data"."fine_penalty",0) = COALESCE("return_data"."decreasing_adjustment",0) THEN "return_data"."bin" END) as metric21,
        COUNT(DISTINCT CASE WHEN COALESCE("return_data"."vds_increasing",0) > 0 AND COALESCE("return_data"."deposited_vat",0) < COALESCE("return_data"."vds_increasing",0) THEN "return_data"."bin" END) as metric22,
        COUNT(DISTINCT CASE WHEN (COALESCE("bin_data"."manufacturing_area",'') = '' OR "bin_data"."manufacturing_area" IS NULL) AND COALESCE("return_data"."total_input_tax_credit_vat",0) > 0 THEN "return_data"."bin" END) as metric23
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
    `)
    );
    const metrics = metricsResult[0] || {};
    const metricsFormatted: any = {};
    for (const key of Object.keys(metrics)) {
      metricsFormatted[key] = Number(metrics[key]) || 0;
    }

    const rowRiskScoreSql = sql`(
      CASE WHEN COALESCE("return_data"."vds_increasing",0) > 0 AND COALESCE("return_data"."deposited_vat",0) < COALESCE("return_data"."vds_increasing",0) THEN 10 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."net_payable_vat",0) < 0 AND COALESCE("return_data"."deposited_vat",0) > 0 THEN 10 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."closing_balance_vat",0) > 500000 THEN 10 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."net_payable_vat",0) < -100000 THEN 5 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."net_payable_vat",0) > 100000 THEN 5 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."closing_balance_vat",0) > 100000 AND COALESCE("return_data"."closing_balance_vat",0) <= 500000 THEN 5 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."vds_decreasing",0) > 0 THEN 5 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."advanced_tax_paid",0) < COALESCE("return_data"."increasing_adjustment",0) THEN 5 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."total_sales_value",0) > 0 AND COALESCE("return_data"."total_payable_vat",0) = 0 THEN 2 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."decreasing_adjustment",0) > 0 THEN 2 ELSE 0 END +
      CASE WHEN COALESCE("return_data"."total_input_tax_credit_value",0) > 0 THEN 2 ELSE 0 END
    )`;

    const scoreQuery = sql`
      WITH BIN_SCORES AS (
        SELECT "return_data"."bin",
               SUM(
                 CASE WHEN cast("return_data"."tax_period" as date) < cast(to_date(${fromDateStr}, 'YYYY-MM') as date) THEN
                   ${rowRiskScoreSql}
                 ELSE 0 END
               ) as historical_score,
               SUM(
                 CASE WHEN cast("return_data"."tax_period" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date) AND cast("return_data"."tax_period" as date) <= cast(to_date(${toDateStr}, 'YYYY-MM') as date) THEN
                   ${rowRiskScoreSql}
                 ELSE 0 END
               ) as current_score
        FROM "return_data"
        INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
        WHERE ${baseFilter}
        GROUP BY "return_data"."bin"
      )
      SELECT bin, historical_score, current_score, (historical_score + current_score) as total_score
      FROM BIN_SCORES
      ORDER BY total_score DESC
    `;

    const riskScores = extractRows(await db.execute(scoreQuery));

    let limitNum = riskScores.length;
    if (topLimit && topLimit !== "All") {
      const parsed = parseInt(topLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limitNum = parsed;
      }
    }
    const filteredRiskScores = riskScores.slice(0, limitNum);

    let high = 0,
      risky = 0,
      low = 0,
      safe = 0,
      newlyRisky = 0,
      improving = 0;
    for (const r of filteredRiskScores) {
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

    const newBinsEntities = extractRows(
      await db.execute(sql`
      SELECT 
        "bin_data"."bin",
        "bin_data"."bin_issue_date"
      FROM "bin_data"
      WHERE cast("bin_data"."bin_issue_date" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date)
        AND cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')
      ${
        !isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0
          ? sql`AND "bin_data"."circle_id" IN (${sql.join(
              allowedCircleIds.map((id: number) => sql`${id}`),
              sql`, `
            )})`
          : isUnauthorized
            ? sql`AND 1=0`
            : sql``
      }
      ${
        psIds.length > 0
          ? sql`AND "bin_data"."police_station_id" IN (${sql.join(
              psIds.map((id: number) => sql`${id}`),
              sql`, `
            )})`
          : sql``
      }
      ${
        majorAreas.length > 0
          ? sql`AND "bin_data"."major_area" IN (${sql.join(
              majorAreas.map((a: string) => sql`${a}`),
              sql`, `
            )})`
          : sql``
      }
      ${
        mfgAreas.length > 0
          ? sql`AND "bin_data"."manufacturing_area" IN (${sql.join(
              mfgAreas.map((a: string) => sql`${a}`),
              sql`, `
            )})`
          : sql``
      }
      ${
        serviceAreas.length > 0
          ? sql`AND "bin_data"."service_area" IN (${sql.join(
              serviceAreas.map((a: string) => sql`${a}`),
              sql`, `
            )})`
          : sql``
      }
    `)
    );
    const newBinsTotal = newBinsEntities.length;

    // Calculate expected returns for newly issued BINs in the selected period
    const [fromY, fromM] = fromDateStr.split("-").map(Number);
    const [toY, toM] = toDateStr.split("-").map(Number);
    const toIndex = toY * 12 + toM;

    let newBinsExpected = 0;
    for (const ent of newBinsEntities) {
      if (!ent.bin_issue_date) continue;
      const d = new Date(ent.bin_issue_date);
      const entIndex = d.getFullYear() * 12 + (d.getMonth() + 1);
      const effStartIndex = Math.max(entIndex, fromY * 12 + fromM);
      if (effStartIndex <= toIndex) {
        newBinsExpected += (toIndex - effStartIndex + 1);
      }
    }

    const newBinsFiledResult = extractRows(
      await db.execute(sql`
      SELECT 
        COUNT(DISTINCT CONCAT("return_data"."bin", '_', cast("return_data"."tax_period" as date))) as filed,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN CONCAT("return_data"."bin", '_', cast("return_data"."tax_period" as date)) END) as activity_yes,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL THEN CONCAT("return_data"."bin", '_', cast("return_data"."tax_period" as date)) END) as activity_no
      FROM "bin_data"
      INNER JOIN "return_data" ON "bin_data"."bin" = "return_data"."bin"
      WHERE cast("bin_data"."bin_issue_date" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date)
        AND cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')
        AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date)
        AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')
      ${
        !isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0
          ? sql`AND "bin_data"."circle_id" IN (${sql.join(
              allowedCircleIds.map((id: number) => sql`${id}`),
              sql`, `
            )})`
          : isUnauthorized
            ? sql`AND 1=0`
            : sql``
      }
      ${
        psIds.length > 0
          ? sql`AND "bin_data"."police_station_id" IN (${sql.join(
              psIds.map((id: number) => sql`${id}`),
              sql`, `
            )})`
          : sql``
      }
      ${
        majorAreas.length > 0
          ? sql`AND "bin_data"."major_area" IN (${sql.join(
              majorAreas.map((a: string) => sql`${a}`),
              sql`, `
            )})`
          : sql``
      }
      ${
        mfgAreas.length > 0
          ? sql`AND "bin_data"."manufacturing_area" IN (${sql.join(
              mfgAreas.map((a: string) => sql`${a}`),
              sql`, `
            )})`
          : sql``
      }
      ${
        serviceAreas.length > 0
          ? sql`AND "bin_data"."service_area" IN (${sql.join(
              serviceAreas.map((a: string) => sql`${a}`),
              sql`, `
            )})`
          : sql``
      }
    `)
    );
    const newBinsFiled = Number(newBinsFiledResult[0]?.filed) || 0;
    const newBinsActivityYes = Number(newBinsFiledResult[0]?.activity_yes) || 0;
    const newBinsActivityNo = Number(newBinsFiledResult[0]?.activity_no) || 0;
    const newBinsNotFiled = Math.max(0, newBinsExpected - newBinsFiled);

    return c.json({
      data: {
        submissionPercentage,
        totalReturnBins,
        totalRegBins,
        byActivity,
        byRegistration,
        riskBreakdown: { high, risky, low, safe, newlyRisky, improving },
        metrics: metricsFormatted,
        newBins: {
          total: newBinsTotal,
          expected: newBinsExpected,
          filed: newBinsFiled,
          notFiled: newBinsNotFiled,
          activityYes: newBinsActivityYes,
          activityNo: newBinsActivityNo
        }
      }
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
};

export const list: Handler = async (c: any) => {
  const user = c.get("auth");
  const { page, limit, circleId, policeStationId, fromDate, toDate, search } = c.req.query();
  const pageNum = parseInt(page || "1") || 1;
  const limitNum = parseInt(limit || "50") || 50;
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

    let whereClause = isUnauthorized ? sql`1=0` : sql`1=1`;

    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      whereClause = sql`${whereClause} AND "return_data"."circle_id" IN (${sql.join(
        allowedCircleIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (psIds.length > 0) {
      whereClause = sql`${whereClause} AND "bin_data"."police_station_id" IN (${sql.join(
        psIds.map((id: number) => sql`${id}`),
        sql`, `
      )})`;
    }
    if (fromDate) {
      whereClause = sql`${whereClause} AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDate}, 'YYYY-MM') as date)`;
    }
    if (toDate) {
      whereClause = sql`${whereClause} AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDate}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')`;
    }
    if (search) {
      whereClause = sql`${whereClause} AND ("return_data"."bin" ILIKE ${"%" + search + "%"} OR "bin_data"."entity_name" ILIKE ${"%" + search + "%"})`;
    }

    const countResult = extractRows(
      await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${whereClause}
    `)
    );
    const total = Number(countResult[0]?.cnt) || 0;

    const rows = extractRows(
      await db.execute(sql`
      SELECT "return_data"."id", "return_data"."bin", "return_data"."tax_period",
             "bin_data"."entity_name" as "entityName",
             "bin_data"."address",
             "circles"."name" as "circleName",
             "police_stations"."name" as "policeStation"
      FROM "return_data"
      INNER JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      LEFT JOIN "circles" ON "return_data"."circle_id" = "circles"."id"
      LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
      WHERE ${whereClause}
      ORDER BY "return_data"."tax_period" DESC, "return_data"."id" DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `)
    );

    const data = rows.map((r: any) => {
      let taxPeriodStr = "-";
      if (r.tax_period) {
        const d = new Date(r.tax_period);
        const months = [
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
        taxPeriodStr = `${months[d.getMonth()]} ${d.getFullYear()}`;
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

export const searchOptions: Handler = async (c: any) => {
  try {
    const user = c.get("auth");
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    if (approvedCircleIds !== null && approvedCircleIds.length === 0) {
      return c.json({ data: [] });
    }

    const userRows = await db.query.returnData.findMany({
      where: approvedCircleIds !== null ? inArray(returnData.circleId, approvedCircleIds) : undefined,
      columns: { bin: true },
      limit: 10000
    });
    const userBins = Array.from(new Set(userRows.map((r) => r.bin).filter(Boolean))) as string[];

    let allBinData: any[] = [];
    if (userBins.length > 0) {
      const chunkSize = 5000;
      for (let i = 0; i < userBins.length; i += chunkSize) {
        const chunk = userBins.slice(i, i + chunkSize);
        const chunkData = await db.query.binData.findMany({
          where: inArray(binData.bin, chunk),
          columns: {
            bin: true,
            entityName: true,
            address: true,
            email: true,
            mobile: true
          }
        });
        allBinData.push(...chunkData);
      }
    }

    return c.json({ data: allBinData });
  } catch (error) {
    console.error("Search Options Error:", error);
    return c.json({ error: "Failed to fetch search options" }, 500);
  }
};
