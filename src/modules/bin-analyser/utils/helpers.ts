import { db } from "@/framework/facade.js";
import { and, eq, inArray, sql, or } from "drizzle-orm";
import { binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { circles, policeStations, appSettings, subscriptions } from "@/modules/settings/database/models/settings.js";

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, keys));
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function getUserApprovedCircleIds(user: any): Promise<number[] | null> {
  if (user.role === 'admin' || user.role?.name === 'admin') return null;
  const subs = await db.select({ circleId: subscriptions.circleId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.sub ?? user.id), eq(subscriptions.status, 'approved')));
  return subs.map(s => s.circleId);
}

export function getCircleCondition(approvedCircleIds: number[] | null, column: any) {
  if (approvedCircleIds === null) return undefined;
  if (approvedCircleIds.length === 0) return sql`1 = 0`;
  return inArray(column, approvedCircleIds);
}

export async function resolveCircleId(circleName: string): Promise<number | null> {
  const row = await db.select({ id: circles.id }).from(circles).where(eq(circles.name, circleName)).limit(1);
  return row[0]?.id ?? null;
}

export async function resolvePSIds(psArr: string[]): Promise<number[]> {
  const rows = await db.select({ id: policeStations.id }).from(policeStations).where(inArray(policeStations.name, psArr));
  return rows.map(r => r.id);
}

/**
 * Rebuild the `bin_area_dimension` filter-options table from `bin_data`.
 *
 * Why: The dashboard's area dropdowns only need the distinct (major, mfg,
 *      service) tuples; deriving them by unnesting every BIN row on each cold
 *      request is wasteful once the set is tiny and stable.
 * When: After a BIN import/delete (data changed) — the model hook seeds it once.
 * How: TRUNCATE + INSERT ... SELECT DISTINCT inside one transaction so readers
 *      never observe a half-empty table. Same relation semantics as the hook.
 */
export async function rebuildBinAreaDimension(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS "bin_area_dimension" ("major" text, "mfg" text, "service" text)`);
    await tx.execute(sql`TRUNCATE TABLE "bin_area_dimension"`);
    await tx.execute(sql`
      INSERT INTO "bin_area_dimension" ("major", "mfg", "service")
      SELECT DISTINCT "major", "mfg", "service" FROM (
        SELECT maj AS "major", mf AS "mfg", NULL::text AS "service"
        FROM "bin_data" b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj, unnest(COALESCE(b."manufacturing_areas", '{}'::text[])) AS mf
        UNION
        SELECT maj AS "major", NULL::text AS "mfg", sv AS "service"
        FROM "bin_data" b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj, unnest(COALESCE(b."service_areas", '{}'::text[])) AS sv
        UNION
        SELECT maj AS "major", NULL::text AS "mfg", NULL::text AS "service"
        FROM "bin_data" b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj
        WHERE COALESCE(cardinality(b."manufacturing_areas"), 0) = 0
          AND COALESCE(cardinality(b."service_areas"), 0) = 0
      ) rel
    `);
  });
}

export function parseAreaParam(param: string | null | undefined): string[] {
  if (!param || param === "All") return [];
  if (param.includes("|||")) {
    return param.split("|||").map((s) => s.trim()).filter(Boolean);
  }
  if (param.includes(";")) {
    return param.split(";").map((s) => s.trim()).filter(Boolean);
  }
  let str = param;
  const placeholders: { [k: string]: string } = {};
  if (str.includes("Trading, including e-Commerce")) {
    str = str.replace(/Trading,\s*including e-Commerce/g, "___TRADING_ECOMMERCE___");
    placeholders["___TRADING_ECOMMERCE___"] = "Trading, including e-Commerce";
  }
  if (str.includes("Leather, Leather Products & Footwear")) {
    str = str.replace(/Leather,\s*Leather Products & Footwear/g, "___LEATHER_FOOTWEAR___");
    placeholders["___LEATHER_FOOTWEAR___"] = "Leather, Leather Products & Footwear";
  }
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => placeholders[s] || s);
}

export async function buildConditions(c: any, user: any, ignoreDateFilters = false) {
  const approvedCircleIds = await getUserApprovedCircleIds(user);
  const circleCond = getCircleCondition(approvedCircleIds, binData.circleId);

  const conditions: any[] = [];
  if (circleCond) conditions.push(circleCond);

  const status = c.req.query('status');
  const forced = c.req.query('forcedRegistration') || c.req.query('reg');
  const majorArea = c.req.query('majorArea') || c.req.query('major');
  const mfgArea = c.req.query('manufacturingArea') || c.req.query('mfg');
  const srvArea = c.req.query('serviceArea') || c.req.query('service');
  const circle = c.req.query('circle') || c.req.query('circles');
  const year = c.req.query('year');
  const fromDate = c.req.query('fromDate') || c.req.query('fromIssueDate');
  const toDate = c.req.query('toDate') || c.req.query('toIssueDate');
  const policeStationsStr = c.req.query('policeStations') || c.req.query('policeStation') || c.req.query('ps');
  const q = c.req.query('q');

  if (status && status !== 'All') {
    const arr = status.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (arr.length > 0) conditions.push(inArray(binData.binStatus, arr));
  }
  if (forced && forced !== 'All') {
    const arr = forced.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (arr.length > 0) {
      const regValues = arr.map((v: string) => (v === 'Forced' ? 'Yes' : v === 'Regular' ? 'No' : v));
      conditions.push(inArray(binData.forcedRegistration, regValues));
    }
  }

  const majorList = parseAreaParam(majorArea);
  if (majorList.length > 0) {
    const orClauses = majorList.map((v) => sql`${binData.majorAreaOfEconomicActivity} ILIKE ${"%" + v + "%"}`);
    conditions.push(or(...orClauses)!);
  }

  const mfgList = parseAreaParam(mfgArea);
  if (mfgList.length > 0) {
    const orClauses = mfgList.map((v) => sql`${binData.areasOfManufacturing} ILIKE ${"%" + v + "%"}`);
    conditions.push(or(...orClauses)!);
  }

  const srvList = parseAreaParam(srvArea);
  if (srvList.length > 0) {
    const orClauses = srvList.map((v) => sql`${binData.areasOfService} ILIKE ${"%" + v + "%"}`);
    conditions.push(or(...orClauses)!);
  }

  if (circle && circle !== 'All') {
    const arr = circle.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (arr.length > 0) {
      const cids = await Promise.all(arr.map((n: string) => resolveCircleId(n)));
      const validCids = cids.filter(id => id !== null) as number[];
      conditions.push(validCids.length > 0 ? inArray(binData.circleId, validCids) : sql`1 = 0`);
    }
  }

  if (policeStationsStr && policeStationsStr !== 'All' && policeStationsStr.length > 0) {
    const psArr = policeStationsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (psArr.length > 0) {
      const psIds = await resolvePSIds(psArr);
      conditions.push(psIds.length > 0 ? inArray(binData.policeStationId, psIds) : sql`1 = 0`);
    }
  }

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(sql`(${binData.bin} ILIKE ${term} OR ${binData.entityName} ILIKE ${term} OR ${binData.mobile} ILIKE ${term} OR ${binData.eTin} ILIKE ${term})`);
  }

  if (!ignoreDateFilters) {
    if (year && year !== 'All') {
      conditions.push(sql`extract(year from ${binData.binIssueDate}) = ${parseInt(year, 10)}`);
    } else {
      if (fromDate) conditions.push(sql`${binData.binIssueDate} >= cast(${fromDate + ' 00:00:00'} as timestamp)`);
      if (toDate) conditions.push(sql`${binData.binIssueDate} <= cast(${toDate + ' 23:59:59'} as timestamp)`);
    }
  }

  return { conditions, approvedCircleIds };
}
