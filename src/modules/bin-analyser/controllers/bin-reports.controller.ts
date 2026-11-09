import type { Handler } from "hono";
import { db, cache } from "@/framework/facade.js";
import { and, eq, inArray, isNotNull, sql, desc, or } from "drizzle-orm";
import { binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { circles, policeStations, divisions } from "@/modules/settings/database/models/settings.js";
import { buildConditions, getUserApprovedCircleIds, getCircleCondition } from "@/modules/bin-analyser/utils/helpers.js";

export const list: Handler = async (c: any) => {
  try {
    const page = Math.max(1, Number(c.req.query('page') || '1'));
    const limit = Math.min(Math.max(1, Number(c.req.query('limit') || '50')), 200);
    const offset = (page - 1) * limit;

    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rawItems, totalResult] = await Promise.all([
      db.select({
        id: binData.id, bin: binData.bin, entityName: binData.entityName,
        binIssueDate: binData.binIssueDate, binStatus: binData.binStatus,
        forcedRegistration: binData.forcedRegistration,
        majorAreaOfEconomicActivity: binData.majorAreaOfEconomicActivity,
        areasOfManufacturing: binData.areasOfManufacturing,
        areasOfService: binData.areasOfService,
        email: binData.email, mobile: binData.mobile, address: binData.address,
        policeStation: policeStations.name, eTin: binData.eTin,
        circleId: binData.circleId, divisionId: binData.divisionId,
        circleName: circles.name, divisionName: divisions.name
      }).from(binData)
        .leftJoin(circles, eq(binData.circleId, circles.id))
        .leftJoin(divisions, eq(binData.divisionId, divisions.id))
        .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
        .where(whereClause)
        .orderBy(desc(binData.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`cast(count(${binData.id}) as integer)` })
        .from(binData)
        .where(whereClause)
    ]);

    const count = totalResult[0]?.count ?? 0;
    const items = rawItems.map(row => {
      let formattedDate = null;
      if (row.binIssueDate) {
        const d = row.binIssueDate;
        formattedDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      }
      return { ...row, circle: row.circleName, division: row.divisionName, binIssueDate: formattedDate };
    });

    return c.json({
      data: items,
      meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch list' }, 500);
  }
};

export const filters: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const circleCondition = getCircleCondition(approvedCircleIds, binData.circleId);
    const psCircleCondition = getCircleCondition(approvedCircleIds, policeStations.circleId);
    const filterCircle = c.req.query('circle');
    const userKey = user?.id ?? "public";
    const circleKey = filterCircle || "all";
    const cacheKey = `bin:filters:v2:${userKey}:${circleKey}`;

    const data = await cache.remember(cacheKey, 86400, async () => {
      let psTargetCircleIds: number[] = [];
      if (filterCircle && filterCircle !== 'All') {
        const rawCircleParts = filterCircle.includes('|||')
          ? filterCircle.split('|||')
          : filterCircle.split(',');
        const resolved = await Promise.all(
          rawCircleParts.map((s: string) => resolveCircleId(s))
        );
        psTargetCircleIds = resolved.filter((id): id is number => id !== null);
      }

      const [circlesList, policeStationsList, statuses, forcedRegistrations, yearsResult, [totalRows], majorAreas, mfgAreas, serviceAreas, areaRelations] = await Promise.all([
        db.selectDistinct({ id: circles.id, name: circles.name }).from(binData)
          .innerJoin(circles, eq(binData.circleId, circles.id))
          .where(and(isNotNull(binData.circleId), circleCondition)),
      db.selectDistinct({ policeStation: policeStations.name }).from(policeStations)
        .leftJoin(circles, eq(policeStations.circleId, circles.id))
        .where(and(
          sql`${policeStations.name} IS NOT NULL AND ${policeStations.name} != ''`,
          psCircleCondition,
          psTargetCircleIds.length > 0
            ? inArray(policeStations.circleId, psTargetCircleIds)
            : undefined
        )),
      db.selectDistinct({ binStatus: binData.binStatus }).from(binData)
        .where(and(sql`${binData.binStatus} IS NOT NULL AND ${binData.binStatus} != ''`, circleCondition)),
      db.selectDistinct({ forcedRegistration: binData.forcedRegistration }).from(binData)
        .where(and(sql`${binData.forcedRegistration} IS NOT NULL AND ${binData.forcedRegistration} != ''`, circleCondition)),
      db.select({ year: sql<number>`extract(year from ${binData.binIssueDate})` }).from(binData)
        .where(and(isNotNull(binData.binIssueDate), circleCondition))
        .groupBy(sql`extract(year from ${binData.binIssueDate})`)
        .orderBy(sql`extract(year from ${binData.binIssueDate}) DESC`),
      db.select({ total: sql<number>`cast(count(${binData.id}) as integer)` }).from(binData).where(circleCondition),
      db.selectDistinct({ major: binData.majorAreaOfEconomicActivity }).from(binData)
        .where(sql`${binData.majorAreaOfEconomicActivity} IS NOT NULL AND ${binData.majorAreaOfEconomicActivity} != ''`),
      db.selectDistinct({ mfg: binData.areasOfManufacturing }).from(binData)
        .where(sql`${binData.areasOfManufacturing} IS NOT NULL AND ${binData.areasOfManufacturing} != 'None' AND ${binData.areasOfManufacturing} != ''`),
      db.selectDistinct({ service: binData.areasOfService }).from(binData)
        .where(sql`${binData.areasOfService} IS NOT NULL AND ${binData.areasOfService} != 'None' AND ${binData.areasOfService} != ''`),
      db.selectDistinct({
        major: binData.majorAreaOfEconomicActivity,
        mfg: binData.areasOfManufacturing,
        service: binData.areasOfService
      }).from(binData)
        .where(sql`${binData.majorAreaOfEconomicActivity} IS NOT NULL AND ${binData.majorAreaOfEconomicActivity} != ''`)
    ]);

    const distinctMajorSet = new Set<string>();
    for (const m of majorAreas) {
      if (m.major) {
        m.major.split(";").map((s: string) => s.trim()).filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A").forEach((s: string) => distinctMajorSet.add(s));
      }
    }

    const distinctMfgSet = new Set<string>();
    for (const m of mfgAreas) {
      if (m.mfg) {
        m.mfg.split(";").map((s: string) => s.trim()).filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A").forEach((s: string) => distinctMfgSet.add(s));
      }
    }

    const distinctServiceSet = new Set<string>();
    for (const s of serviceAreas) {
      if (s.service) {
        s.service.split(";").map((str: string) => str.trim()).filter((str: string) => Boolean(str) && str !== "None" && str !== "N/A").forEach((str: string) => distinctServiceSet.add(str));
      }
    }

    const expandedAreaRelations: { major: string; mfg: string | null; service: string | null }[] = [];
    const relKeySet = new Set<string>();

    for (const r of areaRelations) {
      const majors = (r.major || "").split(";").map((s: string) => s.trim()).filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A");
      const mfgs = (r.mfg || "").split(";").map((s: string) => s.trim()).filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A");
      const services = (r.service || "").split(";").map((s: string) => s.trim()).filter((s: string) => Boolean(s) && s !== "None" && s !== "N/A");

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

      return {
        total: totalRows?.total || 0,
        circles: circlesList
          .filter(c => c.name && c.id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => ({
            id: c.id,
            name: c.name,
            label: c.name,
            value: c.id
          })),
        policeStations: policeStationsList.map(p => p.policeStation).sort(),
        statuses: statuses.map(s => s.binStatus).sort(),
        forcedRegistrations: forcedRegistrations.map(f => f.forcedRegistration).sort(),
        majorAreas: Array.from(distinctMajorSet).sort(),
        mfgAreas: Array.from(distinctMfgSet).sort(),
        serviceAreas: Array.from(distinctServiceSet).sort(),
        areaRelations: expandedAreaRelations,
        years: yearsResult.map(y => Math.floor(y.year).toString())
      };
    });

    return c.json(data);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch filters' }, 500);
  }
};

export const allStats: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const userKey = user?.id ?? "public";
    const cacheKey = `bin:stats:${userKey}:${c.req.url}`;

    const statsData = await cache.remember(cacheKey, 86400, async () => {
      const { conditions } = await buildConditions(c, user);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const fullDetails = c.req.query('fullDetails') === 'true';
      const topN = fullDetails ? undefined : 10;

    const areaQuery = (col: any, extra?: any) => {
      const q = db.select({ area: col, count: sql<number>`cast(count(${binData.id}) as integer)` })
        .from(binData)
        .where(extra ? and(whereClause, extra) : whereClause)
        .groupBy(col)
        .orderBy(sql`count(${binData.id}) DESC`);
      return topN ? q.limit(topN) : q;
    };

    const summaryQuery = db.select({
      total: sql<number>`cast(count(${binData.id}) as integer)`,
      active: sql<number>`cast(count(case when ${binData.binStatus} = 'Active' then 1 end) as integer)`,
      suspended: sql<number>`cast(count(case when ${binData.binStatus} = 'Suspended' then 1 end) as integer)`,
      forced: sql<number>`cast(count(case when ${binData.forcedRegistration} = 'Yes' then 1 end) as integer)`,
      cancelled: sql<number>`cast(count(case when ${binData.binStatus} = 'Cancelled' then 1 end) as integer)`
    }).from(binData).where(whereClause);

    const [
      statusResult, majorAreaResult, mfgResult, srvResult,
      [summaryRow],
      pivotResult
    ] = await Promise.all([
      db.select({ status: binData.binStatus, count: sql<number>`cast(count(${binData.id}) as integer)` })
        .from(binData).where(whereClause).groupBy(binData.binStatus),
      areaQuery(binData.majorAreaOfEconomicActivity),
      areaQuery(binData.areasOfManufacturing, sql`${binData.areasOfManufacturing} != 'None'`),
      areaQuery(binData.areasOfService, sql`${binData.areasOfService} != 'None'`),
      summaryQuery,
      (() => {
        const q = db.select({
          majorArea: binData.majorAreaOfEconomicActivity,
          total: sql<number>`cast(count(${binData.id}) as integer)`,
          hasMfg: sql<number>`cast(sum(case when coalesce(nullif(trim(${binData.areasOfManufacturing}), ''), 'None') != 'None' then 1 else 0 end) as integer)`,
          hasSrv: sql<number>`cast(sum(case when coalesce(nullif(trim(${binData.areasOfService}), ''), 'None') != 'None' then 1 else 0 end) as integer)`,
          neither: sql<number>`cast(sum(case when coalesce(nullif(trim(${binData.areasOfManufacturing}), ''), 'None') = 'None' and coalesce(nullif(trim(${binData.areasOfService}), ''), 'None') = 'None' then 1 else 0 end) as integer)`
        }).from(binData).where(whereClause).groupBy(binData.majorAreaOfEconomicActivity).orderBy(sql`count(${binData.id}) DESC`);
        return topN ? q.limit(topN) : q;
      })()
    ]);

    const validTrendBy = ['year', 'month', 'day'];
    const trendBy = validTrendBy.includes(c.req.query('trendBy') || '') ? (c.req.query('trendBy') as string) : 'year';
    const formatStr = trendBy === 'month' ? 'YYYY-MM' : trendBy === 'day' ? 'YYYY-MM-DD' : 'YYYY';

    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');

    let trendResult = await db.select({
      period: sql.raw(`to_char(bin_issue_date, '${formatStr}')`) as any,
      count: sql.raw(`cast(count(id) as integer)`) as any
    }).from(binData)
      .where(and(whereClause ? whereClause : undefined, isNotNull(binData.binIssueDate)))
      .groupBy(sql.raw(`to_char(bin_issue_date, '${formatStr}')`))
      .orderBy(sql.raw(`to_char(bin_issue_date, '${formatStr}') ASC`));

    if (!fromDate && !toDate) {
      if (trendBy === 'year') trendResult = trendResult.slice(-10);
      else if (trendBy === 'month') trendResult = trendResult.slice(-12);
      else trendResult = trendResult.slice(-30);
    }

    return {
        summary: summaryRow || { total: 0, active: 0, suspended: 0, forced: 0, cancelled: 0 },
        charts: {
          status: statusResult,
          majorArea: majorAreaResult,
          mfgArea: mfgResult,
          srvArea: srvResult,
          pivot: pivotResult,
          trend: trendResult
        }
      };
    });

    return c.json(statsData);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
};

export const search: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const rows = await db.select({
      id: binData.id, bin: binData.bin, entityName: binData.entityName,
      binIssueDate: binData.binIssueDate, binStatus: binData.binStatus,
      forcedRegistration: binData.forcedRegistration,
      majorAreaOfEconomicActivity: binData.majorAreaOfEconomicActivity,
      areasOfManufacturing: binData.areasOfManufacturing,
      areasOfService: binData.areasOfService,
      email: binData.email, mobile: binData.mobile, address: binData.address,
      policeStation: policeStations.name, eTin: binData.eTin,
      district: sql<string>`coalesce(${binData.rawJson}::jsonb->>'District', ${binData.rawJson}::jsonb->>'district', '')`,
      circleId: binData.circleId, divisionId: binData.divisionId,
      circleName: circles.name, divisionName: divisions.name
    }).from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .leftJoin(divisions, eq(binData.divisionId, divisions.id))
      .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
      .where(whereClause)
      .limit(500);
      
    const items = rows.map(r => ({
      ...r,
      circle: r.circleName,
      division: r.divisionName,
      binIssueDate: r.binIssueDate ? new Date(r.binIssueDate.getTime() - (r.binIssueDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null
    }));
    return c.json({ data: items });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Failed to search data' }, 500);
  }
};

export const drilldownPivot: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    
    const majorArea = c.req.query('majorArea');
    const columnType = c.req.query('columnType')?.toLowerCase();
    
    if (majorArea && majorArea !== 'All' && majorArea !== 'Unknown') {
      conditions.push(eq(binData.majorAreaOfEconomicActivity, majorArea));
    }
    
    if (columnType === 'neither' || columnType === 'majoronly') {
      conditions.push(sql`coalesce(nullif(trim(${binData.areasOfManufacturing}), ''), 'None') = 'None' AND coalesce(nullif(trim(${binData.areasOfService}), ''), 'None') = 'None'`);
    } else if (columnType === 'mfg') {
      conditions.push(sql`coalesce(nullif(trim(${binData.areasOfManufacturing}), ''), 'None') != 'None'`);
    } else if (columnType === 'srv' || columnType === 'service') {
      conditions.push(sql`coalesce(nullif(trim(${binData.areasOfService}), ''), 'None') != 'None'`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const rows = await db.select({
      id: binData.id, bin: binData.bin, entityName: binData.entityName,
      address: binData.address, mobile: binData.mobile,
      majorArea: binData.majorAreaOfEconomicActivity,
      mfgArea: binData.areasOfManufacturing,
      srvArea: binData.areasOfService,
      circleName: circles.name
    }).from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .where(whereClause)
      .limit(1000);
      
    const data = rows.map(r => ({
      ...r,
      name: r.entityName,
      circle: r.circleName
    }));
    return c.json({ data });
  } catch (error) {
    console.error('Drilldown error:', error);
    return c.json({ error: 'Failed to fetch drilldown data' }, 500);
  }
};

export const comparison: Handler = async (c: any) => {
  try {
    const type = c.req.param('type');
    const groupCol = type === 'manufacturing' ? binData.areasOfManufacturing
      : type === 'service' ? binData.areasOfService
      : binData.majorAreaOfEconomicActivity;

    const user = c.get('auth');
    
    // 1. Build base conditions (ignoring standard date filters)
    const { conditions: baseConditions } = await buildConditions(c, user, true);
    baseConditions.push(
      isNotNull(binData.binIssueDate),
      isNotNull(groupCol),
      sql`${groupCol} != ''`,
      sql`${groupCol} != 'None'`
    );
    
    const fySql = sql<string>`
      CASE 
        WHEN extract(month from ${binData.binIssueDate}) >= 7 THEN 
          cast(extract(year from ${binData.binIssueDate}) as text) || '-' || cast(extract(year from ${binData.binIssueDate}) + 1 as text)
        ELSE 
          cast(extract(year from ${binData.binIssueDate}) - 1 as text) || '-' || cast(extract(year from ${binData.binIssueDate}) as text)
      END
    `;

    // 2. Fetch totalResult (without MM-DD filter) for totalBins and to determine last5FYs
    const totalResult = await db.select({
      area: groupCol,
      fy: fySql,
      count: sql<number>`cast(count(${binData.id}) as integer)`
    }).from(binData)
      .where(and(...baseConditions))
      .groupBy(groupCol, fySql);

    const allFYs = Array.from(new Set<string>(totalResult.map(r => String(r.fy)))).sort();
    const last5FYs: string[] = allFYs.slice(-5);

    const pivotData: Record<string, any> = {};
    for (const row of totalResult) {
      const areaKey = String(row.area || 'Unknown');
      const fyKey = String(row.fy || '');
      if (!pivotData[areaKey]) {
        pivotData[areaKey] = { area: areaKey, totalBins: 0 };
        last5FYs.forEach(fy => pivotData[areaKey][fy] = 0);
      }
      if (last5FYs.includes(fyKey)) {
        pivotData[areaKey].totalBins += row.count;
      }
    }

    // 3. Add YoY MM-DD filter
    const yoyConditions = [...baseConditions];
    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');
    
    if (fromDate && toDate) {
      const fromMD = fromDate.substring(5);
      const toMD = toDate.substring(5);
      if (fromMD <= toMD) {
        yoyConditions.push(sql`to_char(${binData.binIssueDate}, 'MM-DD') >= ${fromMD}`);
        yoyConditions.push(sql`to_char(${binData.binIssueDate}, 'MM-DD') <= ${toMD}`);
      } else {
        yoyConditions.push(or(
          sql`to_char(${binData.binIssueDate}, 'MM-DD') >= ${fromMD}`,
          sql`to_char(${binData.binIssueDate}, 'MM-DD') <= ${toMD}`
        ));
      }
    } else if (fromDate) {
      const fromMD = fromDate.substring(5);
      yoyConditions.push(sql`to_char(${binData.binIssueDate}, 'MM-DD') >= ${fromMD}`);
    } else if (toDate) {
      const toMD = toDate.substring(5);
      yoyConditions.push(sql`to_char(${binData.binIssueDate}, 'MM-DD') <= ${toMD}`);
    }

    // 4. Fetch YoY result (with MM-DD filter)
    const yoyResult = await db.select({
      area: groupCol,
      fy: fySql,
      count: sql<number>`cast(count(${binData.id}) as integer)`
    }).from(binData)
      .where(and(...yoyConditions))
      .groupBy(groupCol, fySql);

    for (const row of yoyResult) {
      const areaKey = String(row.area || 'Unknown');
      const fyKey = String(row.fy || '');
      if (pivotData[areaKey] && last5FYs.includes(fyKey)) {
        pivotData[areaKey][fyKey] = row.count;
      }
    }

    const latestFy = last5FYs[last5FYs.length - 1] || '';
    const finalResult = Object.values(pivotData).sort((a: any, b: any) => (b[latestFy] || 0) - (a[latestFy] || 0));

    return c.json({ fys: last5FYs, data: finalResult });
  } catch (error) {
    console.error('Comparison error:', error);
    return c.json({ error: 'Failed to fetch comparison data' }, 500);
  }
};

// Helper for string similarity / normalization
const normalizeName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(enterprise|enterprises|trading|trade|international|builders|builder|ltd|limited|co|company|corp|corporation)$/g, '');
};

const areNamesSimilar = (nameA: string, nameB: string): boolean => {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Simple bigram Dice coefficient
  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) s.add(str.substring(i, i + 2));
    return s;
  };
  const bgA = getBigrams(normA);
  const bgB = getBigrams(normB);
  let intersection = 0;
  bgA.forEach(b => { if (bgB.has(b)) intersection++; });
  const similarity = (2.0 * intersection) / (bgA.size + bgB.size);
  return similarity >= 0.65;
};

export const duplicates: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    // User requested only Active status entities
    conditions.push(sql`LOWER(${binData.binStatus}) = 'active'`);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const type = c.req.query('type') || 'true_duplicate'; // 'true_duplicate' | 'same_tin' | 'same_mobile'

    let targetKeys: string[] = [];
    let fieldCol: any = binData.mobile;
    let fieldName: 'eTin' | 'mobile' = 'mobile';

    if (type === 'same_tin') {
      fieldCol = binData.eTin;
      fieldName = 'eTin';
      const dupTins = await db.select({
        val: binData.eTin,
        count: sql<number>`cast(count(${binData.id}) as integer)`
      }).from(binData)
        .where(and(whereClause, sql`${binData.eTin} IS NOT NULL AND ${binData.eTin} != ''`))
        .groupBy(binData.eTin)
        .having(sql`count(${binData.id}) > 1`)
        .limit(100);

      targetKeys = dupTins.map(m => m.val).filter(Boolean) as string[];
    } else if (type === 'same_mobile') {
      fieldCol = binData.mobile;
      fieldName = 'mobile';
      const dupMobiles = await db.select({
        val: binData.mobile,
        count: sql<number>`cast(count(${binData.id}) as integer)`
      }).from(binData)
        .where(and(whereClause, sql`${binData.mobile} IS NOT NULL AND ${binData.mobile} != ''`))
        .groupBy(binData.mobile)
        .having(sql`count(${binData.id}) > 1`)
        .limit(100);

      targetKeys = dupMobiles.map(m => m.val).filter(Boolean) as string[];
    } else {
      // 'true_duplicate': candidate entities that share eTin OR mobile
      // We look for same eTin or same mobile, but later filter by name similarity!
      const dupTins = await db.select({
        val: binData.eTin
      }).from(binData)
        .where(and(whereClause, sql`${binData.eTin} IS NOT NULL AND ${binData.eTin} != ''`))
        .groupBy(binData.eTin)
        .having(sql`count(${binData.id}) > 1`)
        .limit(150);

      const targetTins = dupTins.map(m => m.val).filter(Boolean) as string[];

      if (targetTins.length === 0) {
        return c.json({ data: [] });
      }

      const rows = await db.select({
        id: binData.id, bin: binData.bin, entityName: binData.entityName,
        binIssueDate: binData.binIssueDate, binStatus: binData.binStatus,
        forcedRegistration: binData.forcedRegistration,
        majorAreaOfEconomicActivity: binData.majorAreaOfEconomicActivity,
        areasOfManufacturing: binData.areasOfManufacturing,
        areasOfService: binData.areasOfService,
        email: binData.email, mobile: binData.mobile, address: binData.address,
        circleName: circles.name, policeStation: policeStations.name, eTin: binData.eTin
      }).from(binData)
        .leftJoin(circles, eq(binData.circleId, circles.id))
        .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
        .where(and(whereClause, inArray(binData.eTin, targetTins)))
        .orderBy(binData.eTin);

      // Group by eTin, then filter clusters that have similar names
      const tinMap = new Map<string, any[]>();
      rows.forEach(r => {
        const tin = r.eTin!;
        if (!tinMap.has(tin)) tinMap.set(tin, []);
        tinMap.get(tin)!.push({
          ...r,
          circle: r.circleName,
          binIssueDate: r.binIssueDate ? new Date(r.binIssueDate.getTime() - (r.binIssueDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null
        });
      });

      const trueDuplicateClusters: any[] = [];
      let clusterIdx = 1;

      tinMap.forEach((items, tin) => {
        // Find pairs within the tin group that have similar names
        const matchedItems = new Set<any>();
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (areNamesSimilar(items[i].entityName, items[j].entityName)) {
              matchedItems.add(items[i]);
              matchedItems.add(items[j]);
            }
          }
        }

        if (matchedItems.size > 1) {
          trueDuplicateClusters.push({
            id: clusterIdx++,
            reason: `Potential Duplicate Entity (Same e-TIN & Similar Name: ${tin})`,
            items: Array.from(matchedItems)
          });
        }
      });

      return c.json({ data: trueDuplicateClusters });
    }

    if (targetKeys.length === 0) {
      return c.json({ data: [] });
    }

    const rows = await db.select({
      id: binData.id, bin: binData.bin, entityName: binData.entityName,
      binIssueDate: binData.binIssueDate, binStatus: binData.binStatus,
      forcedRegistration: binData.forcedRegistration,
      majorAreaOfEconomicActivity: binData.majorAreaOfEconomicActivity,
      areasOfManufacturing: binData.areasOfManufacturing,
      areasOfService: binData.areasOfService,
      email: binData.email, mobile: binData.mobile, address: binData.address,
      circleName: circles.name, policeStation: policeStations.name, eTin: binData.eTin
    }).from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
      .where(and(whereClause, inArray(fieldCol, targetKeys)))
      .orderBy(fieldCol);

    const groupMap = new Map<string, any[]>();
    rows.forEach(r => {
      const key = fieldName === 'eTin' ? r.eTin! : r.mobile!;
      if (!key) return;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push({
        ...r,
        circle: r.circleName,
        binIssueDate: r.binIssueDate ? new Date(r.binIssueDate.getTime() - (r.binIssueDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null
      });
    });

    const data = Array.from(groupMap.entries()).map(([key, items], idx) => ({
      id: idx + 1,
      reason: fieldName === 'eTin' ? `Same Owner (e-TIN: ${key})` : `Duplicate Mobile: ${key}`,
      items
    }));

    return c.json({ data });
  } catch (error) {
    console.error('Duplicates error:', error);
    return c.json({ error: 'Failed to fetch duplicates' }, 500);
  }
};
