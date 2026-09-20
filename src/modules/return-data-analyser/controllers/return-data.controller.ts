import * as xlsx from "xlsx";
import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { and, eq, inArray, sql, isNotNull, desc } from "drizzle-orm";
import { columnMappings, binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import { circles, policeStations, subscriptions, divisions, appSettings } from "@/modules/settings/database/models/settings.js";

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, keys));
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function extractRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return Array.from(result || []);
}

function parseNumeric(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  const clean = String(val).replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n.toString();
}

function parseTaxPeriod(val: string): Date | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split('-');
    const y = parseInt(parts[0] || '0');
    const m = parseInt(parts[1] || '1') - 1;
    if (!isNaN(y) && !isNaN(m) && m >= 0 && m < 12) {
      return new Date(Date.UTC(y, m, 1));
    }
  }
  const parts = trimmed.replace(',', '').split(/\s+/);
  if (parts.length >= 2) {
    const monthStr = parts[0];
    if (!monthStr) return null;
    const year = parseInt(parts[1] as string);
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = months.findIndex(m => m.startsWith(monthStr.toLowerCase().substring(0, 3)));
    if (monthIndex !== -1 && !isNaN(year)) {
      return new Date(Date.UTC(year, monthIndex, 1));
    }
  }
  return null;
}

const DEFAULT_RETURN_DATA_MAPPINGS: Record<string, string> = {
  division: 'Division',
  circle: 'Circle',
  bin: 'BIN',
  submission_id: 'Submission ID',
  tax_period: 'Tax Period',
  has_activities: 'Any activities in this Tax Period?',
  total_sales_value: 'Total Sales Value',
  total_payable_vat: 'Total Payable (VAT)',
  total_payable_sd: 'Total Payable (SD)',
  total_input_tax_credit_value: 'Total Input Tax Credit (Value)',
  total_input_tax_credit_vat: 'Total Input Tax Credit (VAT)',
  increasing_adjustment: 'Increasing Adjustment',
  decreasing_adjustment: 'Decreasing Adjustment',
  net_payable_vat: 'Net Payable (VAT)',
  net_payable_sd: 'Net Payable (SD)',
  fine_penalty: 'Fine/Penalty for Non-submission Return',
  deposited_vat: 'Deposited (VAT)',
  deposited_sd: 'Deposited (SD)',
  closing_balance_vat: 'Closing Balance (VAT)',
  closing_balance_sd: 'Closing Balance (SD)',
  vds_increasing: 'VDS (Increasing)',
  vds_decreasing: 'VDS (Decreasing)',
  advanced_tax_paid: 'Advanced Tax Paid',
  submission_date: 'Submission Date',
  last_amendment_date: 'Last Amendment Date',
};

async function getUserApprovedCircleIds(user: any): Promise<number[] | null> {
  if (user.role === 'admin' || user.role?.name === 'admin') return null;
  const subs = await db.select({ circleId: subscriptions.circleId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.sub ?? user.id), eq(subscriptions.status, 'approved')));
  return subs.map(s => s.circleId);
}

function resolveAllowedCircleIds(approvedIds: number[] | null, requestedIds: number[]) {
  if (approvedIds === null) {
    return { allowedCircleIds: requestedIds.length > 0 ? requestedIds : null, isUnauthorized: false };
  }
  if (requestedIds.length === 0) {
    return { allowedCircleIds: approvedIds, isUnauthorized: approvedIds.length === 0 };
  }
  const allowed = requestedIds.filter(id => approvedIds.includes(id));
  return { allowedCircleIds: allowed, isUnauthorized: allowed.length === 0 };
}

export const filterOptions: Handler = async (c: any) => {
  const user = c.get('auth');
  try {
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const filterCircles = c.req.query('circles') || c.req.query('circle');
    const circlesArr = filterCircles ? filterCircles.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    const circleWhere = approvedCircleIds !== null
      ? and(isNotNull(binData.circleId), inArray(binData.circleId, approvedCircleIds))
      : isNotNull(binData.circleId);

    const psQuery = circlesArr.length > 0
      ? db.selectDistinct({ policeStation: policeStations.name })
          .from(policeStations)
          .leftJoin(circles, eq(policeStations.circleId, circles.id))
          .where(and(
            sql`${policeStations.name} IS NOT NULL AND ${policeStations.name} != ''`,
            inArray(circles.name, circlesArr)
          ))
      : db.selectDistinct({ policeStation: policeStations.name })
          .from(policeStations)
          .where(sql`${policeStations.name} IS NOT NULL AND ${policeStations.name} != ''`);

    const [circlesList, policeStationsList, statuses, regTypes, majorAreas, mfgAreas, serviceAreas, areaRelations] = await Promise.all([
      db.selectDistinct({ circle: circles.name }).from(binData).leftJoin(circles, eq(binData.circleId, circles.id)).where(circleWhere),
      psQuery,
      db.selectDistinct({ status: binData.binStatus }).from(binData).where(sql`${binData.binStatus} IS NOT NULL AND ${binData.binStatus} != ''`),
      db.selectDistinct({ regType: binData.forcedRegistration }).from(binData).where(sql`${binData.forcedRegistration} IS NOT NULL AND ${binData.forcedRegistration} != ''`),
      db.selectDistinct({ major: binData.majorAreaOfEconomicActivity })
        .from(binData)
        .where(sql`${binData.majorAreaOfEconomicActivity} IS NOT NULL AND ${binData.majorAreaOfEconomicActivity} != ''`),
      db.selectDistinct({ mfg: binData.areasOfManufacturing })
        .from(binData)
        .where(sql`${binData.areasOfManufacturing} IS NOT NULL AND ${binData.areasOfManufacturing} != 'None' AND ${binData.areasOfManufacturing} != ''`),
      db.selectDistinct({ service: binData.areasOfService })
        .from(binData)
        .where(sql`${binData.areasOfService} IS NOT NULL AND ${binData.areasOfService} != 'None' AND ${binData.areasOfService} != ''`),
      db.selectDistinct({
        major: binData.majorAreaOfEconomicActivity,
        mfg: binData.areasOfManufacturing,
        service: binData.areasOfService
      })
      .from(binData)
      .where(sql`${binData.majorAreaOfEconomicActivity} IS NOT NULL AND ${binData.majorAreaOfEconomicActivity} != ''`)
    ]);

    return c.json({
      circles: circlesList.map((c: any) => c.circle).filter(Boolean).sort(),
      policeStations: policeStationsList.map((p: any) => p.policeStation).filter(Boolean).sort(),
      statuses: statuses.map((s: any) => s.status).filter(Boolean).sort(),
      regTypes: regTypes.map((r: any) => r.regType === 'Yes' ? 'Forced' : r.regType === 'No' ? 'Regular' : r.regType).filter(Boolean).sort(),
      majorAreas: majorAreas.map((m: any) => m.major).filter(Boolean).sort(),
      mfgAreas: mfgAreas.map((m: any) => m.mfg).filter(Boolean).sort(),
      serviceAreas: serviceAreas.map((s: any) => s.service).filter(Boolean).sort(),
      areaRelations: areaRelations.map((r: any) => ({
        major: r.major,
        mfg: r.mfg && r.mfg !== 'None' ? r.mfg : null,
        service: r.service && r.service !== 'None' ? r.service : null
      }))
    });
  } catch (error) {
    console.error('Filter Options Error:', error);
    return c.json({ error: 'Failed to fetch options' }, 500);
  }
};

export const analytics: Handler = async (c: any) => {
  const user = c.get('auth');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const circleId = c.req.query('circleId');
  const policeStationId = c.req.query('policeStationId');
  const topLimit = c.req.query('topLimit');
  const majorArea = c.req.query('majorArea');
  const mfgArea = c.req.query('mfgArea');
  const serviceArea = c.req.query('serviceArea');
  
  let fromDateStr = fromDate;
  let toDateStr = toDate;
  if (!fromDateStr || !toDateStr) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    fromDateStr = `${yyyy}-${mm}`;
    toDateStr = `${yyyy}-${mm}`;
  }

  try {
    let cIds: number[] = [];
    if (circleId) cIds = circleId.split(',').map(Number).filter((n: number) => !isNaN(n));

    let psIds: number[] = [];
    if (policeStationId) psIds = policeStationId.split(',').map(Number).filter((n: number) => !isNaN(n));

    let majorAreas: string[] = [];
    if (majorArea) majorAreas = majorArea.split(',').map((s: string) => s.trim()).filter(Boolean);

    let mfgAreas: string[] = [];
    if (mfgArea) mfgAreas = mfgArea.split(',').map((s: string) => s.trim()).filter(Boolean);

    let serviceAreas: string[] = [];
    if (serviceArea) serviceAreas = serviceArea.split(',').map((s: string) => s.trim()).filter(Boolean);

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let baseFilter = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      baseFilter = sql`${baseFilter} AND "return_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (psIds.length > 0) {
      baseFilter = sql`${baseFilter} AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (majorAreas.length > 0) {
      baseFilter = sql`${baseFilter} AND "bin_data"."major_area" IN (${sql.join(majorAreas.map((a: string) => sql`${a}`), sql`, `)})`;
    }
    if (mfgAreas.length > 0) {
      baseFilter = sql`${baseFilter} AND "bin_data"."manufacturing_area" IN (${sql.join(mfgAreas.map((a: string) => sql`${a}`), sql`, `)})`;
    }
    if (serviceAreas.length > 0) {
      baseFilter = sql`${baseFilter} AND "bin_data"."service_area" IN (${sql.join(serviceAreas.map((a: string) => sql`${a}`), sql`, `)})`;
    }

    const dateFilter = sql`${baseFilter} AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date) AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')`;

    const rangeMonths: string[] = [];
    {
      const startD = new Date(fromDateStr + '-01');
      const endD = new Date(toDateStr + '-01');
      let cur = new Date(startD);
      while (cur <= endD) {
        rangeMonths.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    const eligiblePerMonth = await Promise.all(rangeMonths.map(async dateStr => {
      const res = await db.execute(sql`
        SELECT COUNT(DISTINCT "bin_data"."bin") as cnt FROM "bin_data"
        WHERE "bin_data"."bin_status" NOT IN ('Cancelled', 'Suspended')
          AND ("bin_data"."bin_issue_date" IS NULL OR cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${dateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day'))
        ${!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0 ? sql`AND "bin_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})` : (isUnauthorized ? sql`AND 1=0` : sql``)}
        ${psIds.length > 0 ? sql`AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})` : sql``}
        ${majorAreas.length > 0 ? sql`AND "bin_data"."major_area" IN (${sql.join(majorAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
        ${mfgAreas.length > 0 ? sql`AND "bin_data"."manufacturing_area" IN (${sql.join(mfgAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
        ${serviceAreas.length > 0 ? sql`AND "bin_data"."service_area" IN (${sql.join(serviceAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
      `);
      return extractRows(res);
    }));
    const totalRegBins = eligiblePerMonth.reduce((sum, r) => sum + (Number(r[0]?.cnt) || 0), 0);

    const totalReturnBinsResult = extractRows(await db.execute(sql`
      SELECT COUNT(DISTINCT "return_data"."bin") as cnt
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
    `));
    const totalReturnBins = Number(totalReturnBinsResult[0]?.cnt) || 0;
    const submissionPercentage = totalRegBins > 0 ? Math.round((totalReturnBins / totalRegBins) * 100 * 100) / 100 : 0;

    const byActivityResult = extractRows(await db.execute(sql`
      SELECT COALESCE("return_data"."has_activities", 'N/A') as activity, COUNT(DISTINCT "return_data"."bin") as count
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
      GROUP BY activity ORDER BY count DESC
    `));
    const byActivity = byActivityResult.map((r: any) => ({ activity: r.activity, count: Number(r.count) }));

    const byRegistrationResult = extractRows(await db.execute(sql`
      SELECT COALESCE("bin_data"."forced_registration", 'N/A') as forced_registration, COUNT(DISTINCT "return_data"."bin") as count
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
      GROUP BY forced_registration ORDER BY count DESC
    `));
    const byRegistration = byRegistrationResult.map((r: any) => ({ forced_registration: r.forced_registration, count: Number(r.count) }));

    const metricsResult = extractRows(await db.execute(sql`
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
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${dateFilter}
    `));
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
        LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
        WHERE ${baseFilter}
        GROUP BY "return_data"."bin"
      )
      SELECT bin, historical_score, current_score, (historical_score + current_score) as total_score
      FROM BIN_SCORES
      ORDER BY total_score DESC
    `;

    const riskScores = extractRows(await db.execute(scoreQuery));

    let limitNum = riskScores.length;
    if (topLimit && topLimit !== 'All') {
      const parsed = parseInt(topLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limitNum = parsed;
      }
    }
    const filteredRiskScores = riskScores.slice(0, limitNum);

    let high = 0, risky = 0, low = 0, safe = 0, newlyRisky = 0, improving = 0;
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

    const newBinsResult = extractRows(await db.execute(sql`
      SELECT COUNT(DISTINCT "bin_data"."bin") as cnt FROM "bin_data"
      WHERE cast("bin_data"."bin_issue_date" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date)
        AND cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')
      ${!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0 ? sql`AND "bin_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})` : (isUnauthorized ? sql`AND 1=0` : sql``)}
      ${psIds.length > 0 ? sql`AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})` : sql``}
      ${majorAreas.length > 0 ? sql`AND "bin_data"."major_area" IN (${sql.join(majorAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
      ${mfgAreas.length > 0 ? sql`AND "bin_data"."manufacturing_area" IN (${sql.join(mfgAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
      ${serviceAreas.length > 0 ? sql`AND "bin_data"."service_area" IN (${sql.join(serviceAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
    `));
    const newBinsTotal = Number(newBinsResult[0]?.cnt) || 0;

    const newBinsFiledResult = extractRows(await db.execute(sql`
      SELECT 
        COUNT(DISTINCT "bin_data"."bin") as filed,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN "bin_data"."bin" END) as activity_yes,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL THEN "bin_data"."bin" END) as activity_no
      FROM "bin_data"
      INNER JOIN "return_data" ON "bin_data"."bin" = "return_data"."bin"
      WHERE cast("bin_data"."bin_issue_date" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date)
        AND cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')
        AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDateStr}, 'YYYY-MM') as date)
        AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')
      ${!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0 ? sql`AND "bin_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})` : (isUnauthorized ? sql`AND 1=0` : sql``)}
      ${psIds.length > 0 ? sql`AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})` : sql``}
      ${majorAreas.length > 0 ? sql`AND "bin_data"."major_area" IN (${sql.join(majorAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
      ${mfgAreas.length > 0 ? sql`AND "bin_data"."manufacturing_area" IN (${sql.join(mfgAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
      ${serviceAreas.length > 0 ? sql`AND "bin_data"."service_area" IN (${sql.join(serviceAreas.map((a: string) => sql`${a}`), sql`, `)})` : sql``}
    `));
    const newBinsFiled = Number(newBinsFiledResult[0]?.filed) || 0;
    const newBinsActivityYes = Number(newBinsFiledResult[0]?.activity_yes) || 0;
    const newBinsActivityNo = Number(newBinsFiledResult[0]?.activity_no) || 0;
    const newBinsNotFiled = newBinsTotal - newBinsFiled;

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
          filed: newBinsFiled,
          notFiled: newBinsNotFiled,
          activityYes: newBinsActivityYes,
          activityNo: newBinsActivityNo
        }
      }
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
};

export const list: Handler = async (c: any) => {
  const user = c.get('auth');
  const { page, limit, circleId, policeStationId, fromDate, toDate, search } = c.req.query();
  const pageNum = parseInt(page || '1') || 1;
  const limitNum = parseInt(limit || '50') || 50;
  const offset = (pageNum - 1) * limitNum;

  try {
    let cIds: number[] = [];
    if (circleId) cIds = circleId.split(',').map(Number).filter((n: number) => !isNaN(n));

    let psIds: number[] = [];
    if (policeStationId) psIds = policeStationId.split(',').map(Number).filter((n: number) => !isNaN(n));

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let whereClause = isUnauthorized ? sql`1=0` : sql`1=1`;

    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      whereClause = sql`${whereClause} AND "return_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (psIds.length > 0) {
      whereClause = sql`${whereClause} AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (fromDate) {
      whereClause = sql`${whereClause} AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDate}, 'YYYY-MM') as date)`;
    }
    if (toDate) {
      whereClause = sql`${whereClause} AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDate}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')`;
    }
    if (search) {
      whereClause = sql`${whereClause} AND ("return_data"."bin" ILIKE ${'%' + search + '%'} OR "bin_data"."entity_name" ILIKE ${'%' + search + '%'})`;
    }

    const countResult = extractRows(await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${whereClause}
    `));
    const total = Number(countResult[0]?.cnt) || 0;

    const rows = extractRows(await db.execute(sql`
      SELECT "return_data"."id", "return_data"."bin", "return_data"."tax_period",
             "bin_data"."entity_name" as "entityName",
             "bin_data"."address",
             "circles"."name" as "circleName",
             "police_stations"."name" as "policeStation"
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      LEFT JOIN "circles" ON "return_data"."circle_id" = "circles"."id"
      LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
      WHERE ${whereClause}
      ORDER BY "return_data"."tax_period" DESC, "return_data"."id" DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `));

    const data = rows.map((r: any) => {
      let taxPeriodStr = '-';
      if (r.tax_period) {
        const d = new Date(r.tax_period);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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
    console.error('List Error:', error);
    return c.json({ error: 'Failed to fetch list' }, 500);
  }
};

export const parse: Handler = async (c: any) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No valid file uploaded.' }, 400);
    }

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedMimeTypes.includes(file.type) && !file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
      return c.json({ error: 'Only Excel files (.xlsx, .xls) are allowed.' }, 400);
    }

    const cfg = await getSettings(['common_max_file_size_mb', 'common_max_file_rows', 'max_file_size_mb', 'max_file_rows']);
    const maxSizeMb = parseFloat(cfg['common_max_file_size_mb'] || cfg['max_file_size_mb'] || '50');
    const maxRows = parseInt(cfg['common_max_file_rows'] || cfg['max_file_rows'] || '100000', 10);

    if (file.size > maxSizeMb * 1024 * 1024) {
      return c.json({ error: `File size exceeds the maximum allowed ${maxSizeMb}MB.` }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return c.json({ error: 'No sheets found in Excel file.' }, 400);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return c.json({ error: 'Sheet could not be read.' }, 400);

    const rawMatrix = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false });
    const rawMatrixDates = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: true });

    if (!rawMatrix || rawMatrix.length === 0) {
      return c.json({ error: 'The uploaded file is empty.' }, 400);
    }

    if (rawMatrix.length > maxRows + 5) {
      return c.json({ error: `File contains too many rows. Maximum allowed is ${maxRows.toLocaleString()} data rows.` }, 400);
    }

    let dbMappings = await db.query.columnMappings.findMany({
      where: (mappings: any, { or, eq }: any) => or(eq(mappings.module, 'return_data'), eq(mappings.module, 'return'))
    });
    
    const defaultEntries = Object.entries(DEFAULT_RETURN_DATA_MAPPINGS).map(([dbColumn, excelHeader]) => ({
      id: 0,
      module: 'return_data',
      dbColumn,
      excelHeader,
      createdAt: new Date(),
    }));

    if (dbMappings.length === 0) {
      dbMappings = defaultEntries;
    } else {
      defaultEntries.forEach(def => {
        const existing = dbMappings.find((m: any) => m.dbColumn === def.dbColumn);
        if (!existing) {
          dbMappings.push(def);
        } else if (existing.excelHeader) {
          const existingHeaders = existing.excelHeader.split(',').map((s: string) => s.trim().toLowerCase());
          const defHeaders = def.excelHeader.split(',').map((s: string) => s.trim());
          const newToAdd = defHeaders.filter(dh => !existingHeaders.includes(dh.toLowerCase()));
          if (newToAdd.length > 0) {
            existing.excelHeader = `${existing.excelHeader}, ${newToAdd.join(', ')}`;
          }
        }
      });
    }

    const mappingValues = dbMappings.flatMap((m: any) =>
      (m.excelHeader || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    );

    let headerRowIndex = 0;
    let maxMatches = 0;
    for (let i = 0; i < Math.min(20, rawMatrix.length); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      let matches = 0;
      for (const cell of row) {
        if (typeof cell === 'string') {
          if (mappingValues.includes(cell.replace(/\r?\n|\r/g, ' ').trim().toLowerCase())) matches++;
        }
      }
      if (matches > maxMatches) { maxMatches = matches; headerRowIndex = i; }
    }
    if (maxMatches === 0) headerRowIndex = 0;

    const headers = rawMatrix[headerRowIndex] || [];
    let dataStartIndex = headerRowIndex + 1;
    if (dataStartIndex < rawMatrix.length) {
      const nextRow = rawMatrix[dataStartIndex];
      let parenthesisPatternCount = 0;
      if (Array.isArray(nextRow)) {
        for (const cell of nextRow) {
          if (typeof cell === 'string' && /^\(\s*\d+\s*\)$/.test(cell.trim())) parenthesisPatternCount++;
          else if (typeof cell === 'number' && cell < 0) parenthesisPatternCount++;
        }
      }
      if (parenthesisPatternCount >= 2) dataStartIndex++;
    }

    const rawData = [];
    for (let i = dataStartIndex; i < rawMatrix.length; i++) {
      const rowArr = rawMatrix[i];
      const rowArrDates = rawMatrixDates[i] || [];
      if (!Array.isArray(rowArr)) continue;
      if (rowArr.every(cell => cell === null || cell === '')) continue;
      const rowObj: any = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header && typeof header === 'string') {
          const cleanHeader = header.replace(/\r?\n|\r/g, ' ').trim();
          let cellValue = rowArr[j];
          if (rowArrDates[j] instanceof Date && !isNaN(rowArrDates[j].getTime())) {
            const dObj = new Date(rowArrDates[j].getTime() + 4 * 60 * 60 * 1000);
            const yyyy = dObj.getFullYear();
            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dObj.getDate()).padStart(2, '0');
            cellValue = `${yyyy}-${mm}-${dd}`;
          }
          rowObj[cleanHeader] = cellValue;
        }
      }
      rawData.push(rowObj);
    }

    const processedData = [];
    for (const row of rawData) {
      // Filter: Only include rows where return form is "Mushak-9.1: Value Added Tax Return"
      const formKey = Object.keys(row).find(k => {
        const lower = k.trim().toLowerCase();
        return lower === 'name of return form' || lower === 'return form' || lower === 'form name';
      });
      if (formKey) {
        const formVal = String(row[formKey] || '').trim();
        if (formVal !== 'Mushak-9.1: Value Added Tax Return') {
          continue;
        }
      }

      const mappedRow: any = {};
      let hasValidData = false;
      if (dbMappings.length > 0) {
        dbMappings.forEach((mapping: any) => {
          const targetHeaders = mapping.excelHeader.split(',').map((s: string) => s.trim().toLowerCase());
          const combinedValues: string[] = [];
          targetHeaders.forEach((th: string) => {
            const rowKey = Object.keys(row).find(k => k.trim().toLowerCase() === th);
            if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null) {
              combinedValues.push(String(row[rowKey]));
            }
          });
          if (combinedValues.length > 0) {
            mappedRow[mapping.dbColumn] = combinedValues.join(', ');
            hasValidData = true;
          }
        });
      } else {
        hasValidData = true;
      }
      if (!hasValidData) continue;
      mappedRow.rawJson = JSON.stringify(row);
      mappedRow.tempId = Math.random().toString(36).substring(2, 11);
      processedData.push(mappedRow);
    }

    return c.json({ message: 'File processed successfully.', data: processedData });
  } catch (error: any) {
    console.error('Parse Error:', error);
    return c.json({ error: 'Failed to process file.' }, 500);
  }
};

export const save: Handler = async (c: any) => {
  try {
    const { data } = await c.req.json();
    if (!data || !Array.isArray(data) || data.length === 0) {
      return c.json({ error: 'No valid data provided.' }, 400);
    }

    let [existingDivisions, existingCircles] = await Promise.all([
      db.query.divisions.findMany(),
      db.query.circles.findMany(),
    ]);

    const uniqueDivisions = new Set<string>();
    const uniqueCircles = new Map<string, { circleName: string; divisionName: string }>();

    const user = c.get('auth');
    const approvedCircleIds = await getUserApprovedCircleIds(user);

    data.forEach((row: any) => {
      const divisionName = row.division?.trim() ?? null;
      const circleName = row.circle?.trim() ?? null;
      if (divisionName) uniqueDivisions.add(divisionName);
      if (divisionName && circleName) {
        uniqueCircles.set(`${divisionName}-${circleName}`, { circleName, divisionName });
      }
    });

    const missingDivs = Array.from(uniqueDivisions).filter(
      div => !existingDivisions.some((d: any) => d.name.toLowerCase() === div.toLowerCase())
    );

    const missingCircs: { name: string; division: string }[] = [];
    uniqueCircles.forEach(({ circleName, divisionName }) => {
      const parentDiv = existingDivisions.find((d: any) => d.name.toLowerCase() === divisionName.toLowerCase());
      if (!parentDiv) {
        missingCircs.push({ name: circleName, division: divisionName });
      } else {
        const circExists = existingCircles.some((c: any) => c.name.toLowerCase() === circleName.toLowerCase() && c.divisionId === parentDiv.id);
        if (!circExists) {
          missingCircs.push({ name: circleName, division: divisionName });
        }
      }
    });

    if (missingDivs.length > 0 || missingCircs.length > 0) {
      return c.json({
        error: 'Master data missing.',
        missingDivisions: missingDivs,
        missingCircles: missingCircs
      }, 400);
    }

    const divMap = new Map<string, number>();
    existingDivisions.forEach((d: any) => divMap.set(d.name.toLowerCase(), d.id));

    const circleMap = new Map<string, number>();
    existingCircles.forEach((c: any) => circleMap.set(`${c.name.toLowerCase()}_${c.divisionId}`, c.id));

    const toInsert = data.map((row: any) => {
      const divName = (row.division || '').toString().trim();
      const circleName = (row.circle || '').toString().trim();

      let dId = null;
      let cId = null;
      if (divName) dId = divMap.get(divName.toLowerCase()) || null;
      if (circleName && dId) cId = circleMap.get(`${circleName.toLowerCase()}_${dId}`) || null;

      const taxPeriodDate = parseTaxPeriod(row.tax_period || row.taxPeriod || '');

      return {
        divisionId: dId,
        circleId: cId,
        bin: (row.bin || '').toString().trim(),
        submissionId: row.submission_id ? String(row.submission_id).trim() : null,
        taxPeriod: taxPeriodDate,
        hasActivities: row.has_activities ? String(row.has_activities).trim() : null,
        totalSalesValue: parseNumeric(row.total_sales_value),
        totalPayableVat: parseNumeric(row.total_payable_vat),
        totalPayableSd: parseNumeric(row.total_payable_sd),
        totalInputTaxCreditValue: parseNumeric(row.total_input_tax_credit_value),
        totalInputTaxCreditVat: parseNumeric(row.total_input_tax_credit_vat),
        increasingAdjustment: parseNumeric(row.increasing_adjustment),
        decreasingAdjustment: parseNumeric(row.decreasing_adjustment),
        netPayableVat: parseNumeric(row.net_payable_vat),
        netPayableSd: parseNumeric(row.net_payable_sd),
        finePenalty: parseNumeric(row.fine_penalty),
        depositedVat: parseNumeric(row.deposited_vat),
        depositedSd: parseNumeric(row.deposited_sd),
        closingBalanceVat: parseNumeric(row.closing_balance_vat),
        closingBalanceSd: parseNumeric(row.closing_balance_sd),
        vdsIncreasing: parseNumeric(row.vds_increasing),
        vdsDecreasing: parseNumeric(row.vds_decreasing),
        advancedTaxPaid: parseNumeric(row.advanced_tax_paid),
        submissionDate: row.submission_date ? String(row.submission_date).trim() : null,
        lastAmendmentDate: row.last_amendment_date ? String(row.last_amendment_date).trim() : null,
        rawJson: row.rawJson || null,
        uploadedBy: user?.id ?? null
      };
    }).filter(r => r.bin !== '');

    const validToInsert = toInsert.filter(row => {
      if (approvedCircleIds === null) return true;
      return row.circleId && approvedCircleIds.includes(row.circleId);
    });

    if (approvedCircleIds !== null && validToInsert.length === 0) {
      return c.json({ error: 'None of the uploaded rows correspond to your approved circles. You can only upload data for circles you have an approved subscription for.' }, 403);
    }

    const cfg = await getSettings(['bin_format_regex', 'bin_format_description']);
    const binRegexPattern = cfg['bin_format_regex'] || '^[0-9]{9}-[0-9]{4}$';
    const binDesc = cfg['bin_format_description'] || '000000000-0000';
    const binRegex = new RegExp(binRegexPattern);

    const invalidBins = validToInsert.filter(row => row.bin && !binRegex.test(row.bin));
    if (invalidBins.length > 0) {
      return c.json({ error: `Found ${invalidBins.length} rows with invalid BIN format. Expected: ${binDesc}` }, 400);
    }

    if (validToInsert.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < validToInsert.length; i += batchSize) {
        const batch = validToInsert.slice(i, i + batchSize);
        await db.insert(returnData).values(batch).onConflictDoUpdate({
          target: [returnData.bin, returnData.taxPeriod],
          set: {
            submissionId:             sql`EXCLUDED.submission_id`,
            hasActivities:            sql`EXCLUDED.has_activities`,
            totalSalesValue:          sql`EXCLUDED.total_sales_value`,
            totalPayableVat:          sql`EXCLUDED.total_payable_vat`,
            totalPayableSd:           sql`EXCLUDED.total_payable_sd`,
            totalInputTaxCreditValue: sql`EXCLUDED.total_input_tax_credit_value`,
            totalInputTaxCreditVat:   sql`EXCLUDED.total_input_tax_credit_vat`,
            increasingAdjustment:     sql`EXCLUDED.increasing_adjustment`,
            decreasingAdjustment:     sql`EXCLUDED.decreasing_adjustment`,
            netPayableVat:            sql`EXCLUDED.net_payable_vat`,
            netPayableSd:             sql`EXCLUDED.net_payable_sd`,
            finePenalty:              sql`EXCLUDED.fine_penalty`,
            depositedVat:             sql`EXCLUDED.deposited_vat`,
            depositedSd:              sql`EXCLUDED.deposited_sd`,
            closingBalanceVat:        sql`EXCLUDED.closing_balance_vat`,
            closingBalanceSd:         sql`EXCLUDED.closing_balance_sd`,
            vdsIncreasing:            sql`EXCLUDED.vds_increasing`,
            vdsDecreasing:            sql`EXCLUDED.vds_decreasing`,
            advancedTaxPaid:          sql`EXCLUDED.advanced_tax_paid`,
            submissionDate:           sql`EXCLUDED.submission_date`,
            lastAmendmentDate:        sql`EXCLUDED.last_amendment_date`,
            circleId:                 sql`EXCLUDED.circle_id`,
            divisionId:               sql`EXCLUDED.division_id`,
            rawJson:                  sql`EXCLUDED.raw_json`,
          }
        });
      }
    }

    return c.json({ message: 'Data saved successfully.', insertedRows: validToInsert.length });
  } catch (error: any) {
    console.error('Save Error:', error);
    return c.json({ error: error.message || 'Failed to save data.' }, 500);
  }
};

export const deleteAll: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const isAdmin = user.role === 'admin';

    if (isAdmin) {
      // Admin: à¦¸à¦¬ data delete à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡
      const result = await db.delete(returnData).returning({ id: returnData.id });
      return c.json({ message: `Deleted ${result.length} records successfully.`, deletedCount: result.length });
    } else {
      // User: à¦¶à§à¦§à§ à¦¨à¦¿à¦œà§‡à¦° upload à¦•à¦°à¦¾ data delete à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡
      const result = await db.delete(returnData).where(eq(returnData.uploadedBy, user.id)).returning({ id: returnData.id });
      return c.json({ message: `Deleted ${result.length} of your uploaded records.`, deletedCount: result.length });
    }
  } catch (error: any) {
    console.error('Delete Error:', error);
    return c.json({ error: error.message || 'Failed to delete data' }, 500);
  }
};

export const searchOptions: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    if (approvedCircleIds !== null && approvedCircleIds.length === 0) {
      return c.json({ data: [] });
    }

    // LIMIT à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡ â€” unbounded memory load à¦°à§‹à¦§ à¦•à¦°à¦¤à§‡
    const userRows = await db.query.returnData.findMany({
      where: approvedCircleIds !== null ? inArray(returnData.circleId, approvedCircleIds) : undefined,
      columns: { bin: true },
      limit: 10000
    });
    const userBins = Array.from(new Set(userRows.map(r => r.bin).filter(Boolean))) as string[];

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
    console.error('Search Options Error:', error);
    return c.json({ error: 'Failed to fetch search options' }, 500);
  }
};

export const fyComparison: Handler = async (c: any) => {
  const user = c.get('auth');
  const { circleId, policeStationId, fromDate, toDate, fy, forcedRegistration } = c.req.query();

  try {
    let cIds: number[] = [];
    if (circleId) cIds = circleId.split(',').map(Number).filter((n: number) => !isNaN(n));
    let psIds: number[] = [];
    if (policeStationId) psIds = policeStationId.split(',').map(Number).filter((n: number) => !isNaN(n));

    let currentFyStart: number;
    const fyStr = fy ? '' + fy : '';
    if (fyStr) {
      currentFyStart = parseInt(fyStr.split('-')[0] || '0');
    } else {
      const now = new Date();
      currentFyStart = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
    }
    const previousFyStart = currentFyStart - 1;

    const currentFy = currentFyStart + '-' + (currentFyStart + 1).toString().slice(-2);
    const previousFy = previousFyStart + '-' + (previousFyStart + 1).toString().slice(-2);

    const monthNames = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let filterClause = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      filterClause = sql`${filterClause} AND "return_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (psIds.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (forcedRegistration === 'Yes') {
      filterClause = sql`${filterClause} AND "bin_data"."forced_registration" = 'Yes'`;
    }

    const prevDateStrs: string[] = [];
    const currDateStrs: string[] = [];
    for (let i = 0; i < 12; i++) {
      const prevYear = i < 6 ? previousFyStart : previousFyStart + 1;
      const currYear = i < 6 ? currentFyStart : currentFyStart + 1;
      const monthNum = i < 6 ? 7 + i : i - 5;
      const mm = String(monthNum).padStart(2, '0');
      prevDateStrs.push(prevYear + '-' + mm);
      currDateStrs.push(currYear + '-' + mm);
    }
    const allDateStrs = [...prevDateStrs, ...currDateStrs];

    const allReturns = extractRows(await db.execute(sql`
      SELECT 
        to_char("return_data"."tax_period", 'YYYY-MM') as period,
        COUNT(DISTINCT "return_data"."bin") as returns,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN "return_data"."bin" END) as activity_yes,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL THEN "return_data"."bin" END) as activity_no,
        COUNT(DISTINCT CASE WHEN COALESCE("bin_data"."forced_registration", 'N/A') = 'No' OR COALESCE("bin_data"."forced_registration", 'N/A') = 'N/A' THEN "return_data"."bin" END) as forced_no,
        COUNT(DISTINCT CASE WHEN "bin_data"."forced_registration" = 'Yes' THEN "return_data"."bin" END) as forced_yes
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${filterClause}
        AND to_char("return_data"."tax_period", 'YYYY-MM') IN (${sql.join(allDateStrs.map(d => sql`${d}`), sql`, `)})
      GROUP BY to_char("return_data"."tax_period", 'YYYY-MM')
    `));
    const returnsByPeriod: Record<string, any> = {};
    for (const r of allReturns) returnsByPeriod[r.period as string] = r;

    const eligibleResults = await Promise.all(allDateStrs.map(async dateStr => {
      const res = await db.execute(sql`
        SELECT COUNT(DISTINCT "bin_data"."bin") as cnt FROM "bin_data"
        WHERE "bin_data"."bin_status" NOT IN ('Cancelled', 'Suspended')
          AND ("bin_data"."bin_issue_date" IS NULL OR cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${dateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day'))
        ${!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0 ? sql`AND "bin_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})` : (isUnauthorized ? sql`AND 1=0` : sql``)}
        ${psIds.length > 0 ? sql`AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})` : sql``}
        ${forcedRegistration === 'Yes' ? sql`AND "bin_data"."forced_registration" = 'Yes'` : sql``}
      `);
      return extractRows(res);
    }));
    const eligibleByDate: Record<string, number> = {};
    allDateStrs.forEach((d, i) => { eligibleByDate[d] = Number(eligibleResults[i]?.[0]?.cnt) || 0; });

    const targetPeriod = toDate || fromDate || '';
    let reportMonthIndex = -1;
    if (targetPeriod) {
      const tIdx = currDateStrs.findIndex(d => d === targetPeriod);
      if (tIdx !== -1) reportMonthIndex = tIdx;
      else {
        const pIdx = prevDateStrs.findIndex(d => d === targetPeriod);
        if (pIdx !== -1) reportMonthIndex = pIdx;
      }
    }
    if (reportMonthIndex === -1) {
      const now = new Date();
      const nowStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const nIdx = currDateStrs.findIndex(d => d === nowStr);
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
      currentForcedYes: 0,
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
    console.error('FY Comparison Error:', error);
    return c.json({ error: 'Failed to fetch FY comparison data' }, 500);
  }
};

export const yearComparison: Handler = async (c: any) => {
  const user = c.get('auth');
  const { circleId, policeStationId, fromDate, toDate, forcedRegistration } = c.req.query();

  try {
    let cIds: number[] = [];
    if (circleId) cIds = circleId.split(',').map(Number).filter((n: number) => !isNaN(n));
    let psIds: number[] = [];
    if (policeStationId) psIds = policeStationId.split(',').map(Number).filter((n: number) => !isNaN(n));

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let filterClause = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      filterClause = sql`${filterClause} AND "return_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (psIds.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (forcedRegistration === 'Yes') {
      filterClause = sql`${filterClause} AND "bin_data"."forced_registration" = 'Yes'`;
    }

    const refDate = toDate ? new Date(toDate + '-01') : new Date();
    const targetPeriod = toDate ? toDate : `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
    const monthsList: { year: number; month: number; label: string; dateStr: string; monthName: string }[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      monthsList.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        monthName: monthNames[d.getMonth()] || '',
        label: monthLabels[d.getMonth()] + ' ' + d.getFullYear(),
        dateStr: d.getFullYear() + '-' + mm
      });
    }

    let totalSubmissions = 0;
    let totalActivityYes = 0;
    let totalExpectedReturns = 0;
    const months: any[] = [];

    const allDateStrs = monthsList.map(ml => ml.dateStr);

    const allReturns = extractRows(await db.execute(sql`
      SELECT 
        to_char("return_data"."tax_period", 'YYYY-MM') as period,
        COUNT(DISTINCT "return_data"."bin") as submissions,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'Yes' THEN "return_data"."bin" END) as activity_yes,
        COUNT(DISTINCT CASE WHEN "return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL THEN "return_data"."bin" END) as activity_no,
        COUNT(DISTINCT CASE WHEN COALESCE("bin_data"."forced_registration", 'N/A') = 'No' OR COALESCE("bin_data"."forced_registration", 'N/A') = 'N/A' THEN "return_data"."bin" END) as forced_no,
        COUNT(DISTINCT CASE WHEN "bin_data"."forced_registration" = 'Yes' THEN "return_data"."bin" END) as forced_yes
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      WHERE ${filterClause}
        AND to_char("return_data"."tax_period", 'YYYY-MM') IN (${sql.join(allDateStrs.map(d => sql`${d}`), sql`, `)})
      GROUP BY to_char("return_data"."tax_period", 'YYYY-MM')
    `));
    const returnsByPeriod: Record<string, any> = {};
    for (const r of allReturns) returnsByPeriod[r.period as string] = r;

    const eligibleResults = await Promise.all(allDateStrs.map(async dateStr => {
      const res = await db.execute(sql`
        SELECT COUNT(DISTINCT "bin_data"."bin") as cnt FROM "bin_data"
        WHERE "bin_data"."bin_status" NOT IN ('Cancelled', 'Suspended')
          AND ("bin_data"."bin_issue_date" IS NULL OR cast("bin_data"."bin_issue_date" as date) <= (cast(to_date(${dateStr}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day'))
        ${!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0 ? sql`AND "bin_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})` : (isUnauthorized ? sql`AND 1=0` : sql``)}
        ${psIds.length > 0 ? sql`AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})` : sql``}
        ${forcedRegistration === 'Yes' ? sql`AND "bin_data"."forced_registration" = 'Yes'` : sql``}
      `);
      return extractRows(res);
    }));
    const eligibleByDate: Record<string, number> = {};
    allDateStrs.forEach((d, i) => { eligibleByDate[d] = Number(eligibleResults[i]?.[0]?.cnt) || 0; });

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
    console.error('Year Comparison Error:', error);
    return c.json({ error: 'Failed to fetch Year comparison data' }, 500);
  }
};

export const drilldownEntities: Handler = async (c: any) => {
  const user = c.get('auth');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const circleId = c.req.query('circleId');
  const policeStationId = c.req.query('policeStationId');
  const majorArea = c.req.query('majorArea');
  const mfgArea = c.req.query('mfgArea');
  const serviceArea = c.req.query('serviceArea');
  const classificationType = c.req.query('classificationType') || 'activity';
  const categoryValue = c.req.query('categoryValue');

  try {
    let cIds: number[] = [];
    if (circleId) cIds = circleId.split(',').map(Number).filter((n: number) => !isNaN(n));
    let psIds: number[] = [];
    if (policeStationId) psIds = policeStationId.split(',').map(Number).filter((n: number) => !isNaN(n));
    let majorAreas: string[] = [];
    if (majorArea) majorAreas = majorArea.split(',').map((s: string) => s.trim()).filter(Boolean);
    let mfgAreas: string[] = [];
    if (mfgArea) mfgAreas = mfgArea.split(',').map((s: string) => s.trim()).filter(Boolean);
    let serviceAreas: string[] = [];
    if (serviceArea) serviceAreas = serviceArea.split(',').map((s: string) => s.trim()).filter(Boolean);

    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const { allowedCircleIds, isUnauthorized } = resolveAllowedCircleIds(approvedCircleIds, cIds);

    let baseFilterClause = isUnauthorized ? sql`1=0` : sql`1=1`;
    if (!isUnauthorized && allowedCircleIds !== null && allowedCircleIds.length > 0) {
      baseFilterClause = sql`${baseFilterClause} AND "return_data"."circle_id" IN (${sql.join(allowedCircleIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }
    if (psIds.length > 0) {
      baseFilterClause = sql`${baseFilterClause} AND "bin_data"."police_station_id" IN (${sql.join(psIds.map((id: number) => sql`${id}`), sql`, `)})`;
    }

    if (fromDate && toDate) {
      baseFilterClause = sql`${baseFilterClause} AND cast("return_data"."tax_period" as date) >= cast(to_date(${fromDate}, 'YYYY-MM') as date) AND cast("return_data"."tax_period" as date) <= (cast(to_date(${toDate}, 'YYYY-MM') as date) + interval '1 month' - interval '1 day')`;
    }

    // Category Value filtering
    if (classificationType === 'activity') {
      if (categoryValue && categoryValue.toLowerCase().includes('yes')) {
        baseFilterClause = sql`${baseFilterClause} AND "return_data"."has_activities" = 'Yes'`;
      } else if (categoryValue && categoryValue.toLowerCase().includes('no')) {
        baseFilterClause = sql`${baseFilterClause} AND ("return_data"."has_activities" = 'No' OR "return_data"."has_activities" IS NULL)`;
      }
    } else if (classificationType === 'registration') {
      if (categoryValue && categoryValue.toLowerCase().includes('yes')) {
        baseFilterClause = sql`${baseFilterClause} AND "bin_data"."forced_registration" = 'Yes'`;
      } else if (categoryValue && categoryValue.toLowerCase().includes('no')) {
        baseFilterClause = sql`${baseFilterClause} AND ("bin_data"."forced_registration" IS NULL OR "bin_data"."forced_registration" != 'Yes')`;
      }
    }

    // Area filters on top of base filter
    let filterClause = sql`${baseFilterClause}`;
    if (majorAreas.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."major_area" IN (${sql.join(majorAreas.map((a: string) => sql`${a}`), sql`, `)})`;
    }
    if (mfgAreas.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."manufacturing_area" IN (${sql.join(mfgAreas.map((a: string) => sql`${a}`), sql`, `)})`;
    }
    if (serviceAreas.length > 0) {
      filterClause = sql`${filterClause} AND "bin_data"."service_area" IN (${sql.join(serviceAreas.map((a: string) => sql`${a}`), sql`, `)})`;
    }

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
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
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
      binIssueDate: r.binIssueDate || 'N/A',
      circleName: r.circleName,
      policeStationName: r.policeStationName,
      submissionCount: Number(r.submissionCount) || 0,
      totalSalesValue: Number(r.totalSalesValue) || 0,
      totalPayableVat: Number(r.totalPayableVat) || 0,
      totalRebateVat: Number(r.totalRebateVat) || 0,
      totalDecreasingAdjustment: Number(r.totalDecreasingAdjustment) || 0,
      totalNetPayableVat: Number(r.totalNetPayableVat) || 0,
      totalDepositedVat: Number(r.totalDepositedVat) || 0,
    }));

    // 2. Fetch available area options strictly belonging to the institutions in this drilldown context
    const areasQuery = sql`
      SELECT DISTINCT
        "bin_data"."major_area" as "major",
        "bin_data"."manufacturing_area" as "mfg",
        "bin_data"."service_area" as "service"
      FROM "return_data"
      LEFT JOIN "bin_data" ON "return_data"."bin" = "bin_data"."bin"
      LEFT JOIN "circles" ON "return_data"."circle_id" = "circles"."id"
      LEFT JOIN "police_stations" ON "bin_data"."police_station_id" = "police_stations"."id"
      WHERE ${baseFilterClause}
        AND ("bin_data"."major_area" IS NOT NULL OR "bin_data"."manufacturing_area" IS NOT NULL OR "bin_data"."service_area" IS NOT NULL)
    `;
    const areaRows = extractRows(await db.execute(areasQuery));
    const majorSet = new Set<string>();
    const mfgSet = new Set<string>();
    const serviceSet = new Set<string>();
    const areaRelations: { major: string; mfg: string | null; service: string | null }[] = [];

    for (const r of areaRows) {
      if (r.major && r.major.trim() && r.major !== 'N/A' && r.major !== 'None') {
        majorSet.add(r.major.trim());
      }
      if (r.mfg && r.mfg.trim() && r.mfg !== 'N/A' && r.mfg !== 'None') {
        mfgSet.add(r.mfg.trim());
      }
      if (r.service && r.service.trim() && r.service !== 'N/A' && r.service !== 'None') {
        serviceSet.add(r.service.trim());
      }
      if (r.major && r.major.trim() && r.major !== 'N/A' && r.major !== 'None') {
        areaRelations.push({
          major: r.major.trim(),
          mfg: r.mfg && r.mfg !== 'None' && r.mfg !== 'N/A' ? r.mfg.trim() : null,
          service: r.service && r.service !== 'None' && r.service !== 'N/A' ? r.service.trim() : null
        });
      }
    }

    return c.json({
      data: entities,
      areaOptions: {
        majorAreas: Array.from(majorSet).sort(),
        mfgAreas: Array.from(mfgSet).sort(),
        serviceAreas: Array.from(serviceSet).sort(),
        areaRelations
      }
    });
  } catch (error) {
    console.error('Drilldown Entities Error:', error);
    return c.json({ error: 'Failed to fetch drilldown entities' }, 500);
  }
};

export const entityTrends: Handler = async (c: any) => {
  const bin = c.req.query('bin');
  if (!bin) {
    return c.json({ error: 'BIN parameter is required' }, 400);
  }

  try {
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
      LIMIT 1
    `;
    const masterRows = extractRows(await db.execute(masterQuery));
    let entityInfo = masterRows[0];
    if (!entityInfo) {
      entityInfo = {
        bin,
        entityName: 'BIN: ' + bin,
        address: 'N/A',
        hqAddress: '',
        majorArea: 'N/A',
        mfgArea: 'None',
        serviceArea: 'None',
        mobile: 'N/A',
        email: 'N/A',
        forcedRegistration: 'No',
        binIssueDate: 'N/A',
        circleName: 'N/A',
        policeStationName: 'N/A'
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
      let fy = 'Unknown';
      if (r.period) {
        const [yrStr, moStr] = r.period.split('-');
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
        hasActivities: r.hasActivities || 'No',
        totalSalesValue: Number(r.totalSalesValue) || 0,
        totalPayableVat: Number(r.totalPayableVat) || 0,
        totalInputTaxCreditVat: Number(r.totalInputTaxCreditVat) || 0,
        decreasingAdjustment: Number(r.decreasingAdjustment) || 0,
        increasingAdjustment: Number(r.increasingAdjustment) || 0,
        netPayableVat: Number(r.netPayableVat) || 0,
        depositedVat: Number(r.depositedVat) || 0,
        closingBalanceVat: Number(r.closingBalanceVat) || 0,
        submissionDate: r.submissionDate || 'N/A'
      };
    });

    // Group by Fiscal Year for yearly trends
    const yearlyMap: Record<string, any> = {};
    for (const m of monthly) {
      const fy = m.fiscalYear || 'Unknown';
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

    // 3. Compute Compliance / Filing Statistics
    const maxPeriodQuery = sql`SELECT to_char(MAX("tax_period"), 'YYYY-MM') as max_period FROM "return_data"`;
    const maxPeriodRows = extractRows(await db.execute(maxPeriodQuery));
    const latestPeriodStr = maxPeriodRows[0]?.max_period || '';

    let totalDue = monthly.length;
    if (entityInfo.binIssueDate && entityInfo.binIssueDate !== 'N/A' && latestPeriodStr) {
      const [issueYear, issueMonth] = entityInfo.binIssueDate.split('-').map(Number);
      const [latestYear, latestMonth] = latestPeriodStr.split('-').map(Number);
      if (!isNaN(issueYear) && !isNaN(issueMonth) && !isNaN(latestYear) && !isNaN(latestMonth)) {
        const diffMonths = (latestYear - issueYear) * 12 + (latestMonth - issueMonth) + 1;
        totalDue = Math.max(diffMonths, monthly.length, 1);
      }
    }

    const activityYes = monthly.filter((m: any) => m.hasActivities === 'Yes').length;
    const activityNo = monthly.filter((m: any) => m.hasActivities === 'No' || !m.hasActivities).length;
    const nonFiled = Math.max(0, totalDue - monthly.length);

    const compliance = {
      binIssueDate: entityInfo.binIssueDate || 'N/A',
      totalDue,
      totalSubmitted: monthly.length,
      activityYes,
      activityNo,
      nonFiled
    };

    return c.json({
      data: {
        entity: entityInfo,
        compliance,
        monthly,
        yearly
      }
    });
  } catch (error) {
    console.error('Entity Trends Error:', error);
    return c.json({ error: 'Failed to fetch entity trends' }, 500);
  }
};

export const entityDetailsReport: Handler = async (c: any) => {
  const bin = c.req.query('bin');
  if (!bin) {
    return c.json({ error: 'BIN parameter is required' }, 400);
  }

  try {
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
      LIMIT 1
    `;
    const masterRows = extractRows(await db.execute(masterQuery));
    let entityInfo = masterRows[0] || {
      bin,
      entityName: 'BIN: ' + bin,
      address: 'N/A',
      hqAddress: '',
      majorArea: 'N/A',
      mfgArea: 'None',
      serviceArea: 'None',
      mobile: 'N/A',
      email: 'N/A',
      forcedRegistration: 'No',
      binIssueDate: 'N/A',
      circleName: 'N/A',
      divisionName: 'N/A',
      policeStationName: 'N/A'
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

    // 3. Determine 5 Fiscal Years
    const maxPeriodQuery = sql`SELECT to_char(MAX("tax_period"), 'YYYY-MM') as max_period FROM "return_data"`;
    const maxPeriodRows = extractRows(await db.execute(maxPeriodQuery));
    const latestDbPeriod = maxPeriodRows[0]?.max_period || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    const [latestYr, latestMo] = latestDbPeriod.split('-').map(Number);

    const currentFyEndYear = (latestMo >= 7 ? latestYr + 1 : latestYr);
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
      { num: 7, name: 'July', offsetYear: 0 },
      { num: 8, name: 'August', offsetYear: 0 },
      { num: 9, name: 'September', offsetYear: 0 },
      { num: 10, name: 'October', offsetYear: 0 },
      { num: 11, name: 'November', offsetYear: 0 },
      { num: 12, name: 'December', offsetYear: 0 },
      { num: 1, name: 'January', offsetYear: 1 },
      { num: 2, name: 'February', offsetYear: 1 },
      { num: 3, name: 'March', offsetYear: 1 },
      { num: 4, name: 'April', offsetYear: 1 },
      { num: 5, name: 'May', offsetYear: 1 },
      { num: 6, name: 'June', offsetYear: 1 },
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
        const periodKey = `${calYear}-${String(mc.num).padStart(2, '0')}`;
        const isFuture = periodKey > latestDbPeriod;
        const r = returnsByPeriod.get(periodKey);

        let isRegistered = true;
        if (entityInfo.binIssueDate && entityInfo.binIssueDate !== 'N/A') {
          const [issueY, issueM] = entityInfo.binIssueDate.split('-').map(Number);
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
          const totalAdj = (incAdj + vdsInc) - (decAdj + vdsDec + advTax);
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
              type: 'VAT Treasury Shortfall',
              period: `${mc.name} ${calYear}`,
              description: `Net Payable VAT is ${netVat.toLocaleString()}, Previous Closing Balance was ${prevClosingVat.toLocaleString()} (Required: ${requiredVat.toLocaleString()}), but Deposited VAT was ${depVat.toLocaleString()}. Shortfall: ${shortfallVat.toLocaleString()}`
            });
          }

          if (shortfallSd > 0) {
            discrepancies.push({
              type: 'SD Treasury Shortfall',
              period: `${mc.name} ${calYear}`,
              description: `Net Payable SD is ${netSd.toLocaleString()}, Previous Closing Balance SD was ${prevClosingSd.toLocaleString()} (Required: ${requiredSd.toLocaleString()}), but Deposited SD was ${depSd.toLocaleString()}. Shortfall: ${shortfallSd.toLocaleString()}`
            });
          }

          if (r.hasActivities === 'No' && sales > 0) {
            discrepancies.push({
              type: 'Activity Status Inconsistency',
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
            hasActivities: r.hasActivities || 'No',
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
            submissionDate: r.submissionDate || 'N/A',
            submissionId: r.submissionId || 'N/A'
          });
        } else {
          // Missing or Future Month
          if (!isFuture && isRegistered) {
            discrepancies.push({
              type: 'Non-Filed Return',
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
            hasActivities: '-',
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
            submissionDate: '-',
            submissionId: '-'
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

    // 4. Compliance Statistics
    let totalDue = returnRows.length;
    if (entityInfo.binIssueDate && entityInfo.binIssueDate !== 'N/A' && latestDbPeriod) {
      const [issueYear, issueMonth] = entityInfo.binIssueDate.split('-').map(Number);
      if (!isNaN(issueYear) && !isNaN(issueMonth) && !isNaN(latestYr) && !isNaN(latestMo)) {
        const diffMonths = (latestYr - issueYear) * 12 + (latestMo - issueMonth) + 1;
        totalDue = Math.max(diffMonths, returnRows.length, 1);
      }
    }
    const totalSubmitted = returnRows.length;
    const activityYes = returnRows.filter((m: any) => m.hasActivities === 'Yes').length;
    const activityNo = returnRows.filter((m: any) => m.hasActivities === 'No' || !m.hasActivities).length;
    const nonFiled = Math.max(0, totalDue - totalSubmitted);

    const compliance = {
      binIssueDate: entityInfo.binIssueDate || 'N/A',
      totalDue,
      totalSubmitted,
      activityYes,
      activityNo,
      nonFiled,
      complianceRate: totalDue > 0 ? ((totalSubmitted / totalDue) * 100).toFixed(1) : '100.0'
    };

    return c.json({
      data: {
        entity: entityInfo,
        compliance,
        fiscalYears,
        grid: fullGrid,
        grandTotal,
        discrepancies,
        latestPeriod: latestDbPeriod
      }
    });
  } catch (error) {
    console.error('Entity Details Report Error:', error);
    return c.json({ error: 'Failed to fetch entity details report' }, 500);
  }
};

export const nonFilerList: Handler = async (c: any) => {
  const user = c.get('auth');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const filterCircles = c.req.query('circles') || c.req.query('circle');
    const filterPs = c.req.query('ps') || c.req.query('policeStation');
    const filterStatus = c.req.query('status');
    const filterReg = c.req.query('reg') || c.req.query('forcedRegistration');
    const filterMajor = c.req.query('major') || c.req.query('majorArea');
    const filterMfg = c.req.query('mfg') || c.req.query('manufacturingArea');
    const filterService = c.req.query('service') || c.req.query('serviceArea');
    const q = c.req.query('q');

    // 1. Find the latest tax period in return_data
    const maxPeriodRow = await db.select({
      maxPeriod: sql`max(${returnData.taxPeriod})`
    }).from(returnData);
    const latestPeriodDate = maxPeriodRow[0]?.maxPeriod ? new Date(maxPeriodRow[0].maxPeriod) : new Date();
    const latestYr = latestPeriodDate.getUTCFullYear();
    const latestMo = latestPeriodDate.getUTCMonth() + 1;

    // 2. Fetch all matching entities from binData
    const conditions: any[] = [];
    if (approvedCircleIds !== null) {
      if (approvedCircleIds.length === 0) return c.json({ data: [], total: 0 });
      conditions.push(inArray(binData.circleId, approvedCircleIds));
    }

    if (filterCircles && filterCircles !== 'All') {
      const arr = filterCircles.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        const circleRows = await db.select({ id: circles.id }).from(circles).where(inArray(circles.name, arr));
        const cids = circleRows.map((r: any) => r.id);
        conditions.push(cids.length > 0 ? inArray(binData.circleId, cids) : sql`1 = 0`);
      }
    }

    if (filterPs && filterPs !== 'All') {
      const arr = filterPs.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        const psRows = await db.select({ id: policeStations.id }).from(policeStations).where(inArray(policeStations.name, arr));
        const psIds = psRows.map((r: any) => r.id);
        conditions.push(psIds.length > 0 ? inArray(binData.policeStationId, psIds) : sql`1 = 0`);
      }
    }

    if (filterStatus && filterStatus !== 'All') {
      const arr = filterStatus.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) conditions.push(inArray(binData.binStatus, arr));
    }

    if (filterReg && filterReg !== 'All') {
      const arr = filterReg.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        const regValues = arr.map((v: string) => v === 'Forced' ? 'Yes' : v === 'Regular' ? 'No' : v);
        conditions.push(inArray(binData.forcedRegistration, regValues));
      }
    }

    if (filterMajor && filterMajor !== 'All') {
      const arr = filterMajor.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) conditions.push(inArray(binData.majorAreaOfEconomicActivity, arr));
    }

    if (filterMfg && filterMfg !== 'All') {
      const arr = filterMfg.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) conditions.push(inArray(binData.areasOfManufacturing, arr));
    }

    if (filterService && filterService !== 'All') {
      const arr = filterService.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (arr.length > 0) conditions.push(inArray(binData.areasOfService, arr));
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(sql`(${binData.bin} ILIKE ${term} OR ${binData.entityName} ILIKE ${term} OR ${binData.mobile} ILIKE ${term} OR ${binData.eTin} ILIKE ${term})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const entities = await db.select({
      bin: binData.bin,
      name: binData.entityName,
      address: binData.address,
      mobile: binData.mobile,
      eTin: binData.eTin,
      binIssueDate: binData.binIssueDate,
      binStatus: binData.binStatus,
      forcedRegistration: binData.forcedRegistration,
      majorArea: binData.majorAreaOfEconomicActivity,
      manufacturingArea: binData.areasOfManufacturing,
      serviceArea: binData.areasOfService,
      circleName: circles.name,
      policeStationName: policeStations.name
    })
    .from(binData)
    .leftJoin(circles, eq(binData.circleId, circles.id))
    .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
    .where(whereClause)
    .limit(5000); // memory crash à¦°à§‹à¦§ à¦•à¦°à¦¤à§‡ LIMIT à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡

    if (entities.length === 0) {
      return c.json({ data: [], total: 0 });
    }

    // 3. Count returns submitted for each entity
    const returnCounts = await db.select({
      bin: returnData.bin,
      submittedCount: sql<number>`count(distinct ${returnData.taxPeriod})`
    })
    .from(returnData)
    .groupBy(returnData.bin);

    const submissionMap = new Map<string, number>();
    for (const row of returnCounts) {
      if (row.bin) submissionMap.set(row.bin, Number(row.submittedCount) || 0);
    }

    // 4. Calculate Non-Filed Months for each entity
    const results = [];
    for (const ent of entities) {
      if (!ent.bin) continue;

      let totalDue = 1;
      if (ent.binIssueDate) {
        const issueD = new Date(ent.binIssueDate);
        if (!isNaN(issueD.getTime())) {
          const issueYear = issueD.getUTCFullYear();
          const issueMonth = issueD.getUTCMonth() + 1;
          const diffMonths = (latestYr - issueYear) * 12 + (latestMo - issueMonth) + 1;
          totalDue = Math.max(diffMonths, 1);
        }
      }

      const submitted = submissionMap.get(ent.bin) || 0;
      const nonFiledMonths = Math.max(0, totalDue - submitted);

      if (nonFiledMonths > 0) {
        results.push({
          bin: ent.bin,
          name: ent.name || 'N/A',
          address: ent.address || 'N/A',
          mobile: ent.mobile || '-',
          eTin: ent.eTin || '',
          issueDate: ent.binIssueDate,
          grandTotalMonths: nonFiledMonths,
          totalDueMonths: totalDue,
          submittedCount: submitted,
          forcedRegistration: ent.forcedRegistration,
          majorArea: ent.majorArea,
          manufacturingArea: ent.manufacturingArea,
          serviceArea: ent.serviceArea,
          circleName: ent.circleName,
          policeStationName: ent.policeStationName,
          binStatus: ent.binStatus
        });
      }
    }

    // Sort descending by unfiled months
    results.sort((a, b) => b.grandTotalMonths - a.grandTotalMonths);

    return c.json({ data: results, total: results.length });
  } catch (error) {
    console.error('Non Filer List Error:', error);
    return c.json({ error: 'Failed to fetch non filer list' }, 500);
  }
};


