import * as xlsx from 'xlsx';
import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { and, eq, inArray, isNotNull, sql, desc, or } from "drizzle-orm";
import { columnMappings, binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { circles, policeStations, appSettings, subscriptions, divisions } from "@/modules/settings/database/models/settings.js";

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, keys));
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function getUserApprovedCircleIds(user: any): Promise<number[] | null> {
  if (user.role === 'admin' || user.role?.name === 'admin') return null;
  const subs = await db.select({ circleId: subscriptions.circleId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.sub ?? user.id), eq(subscriptions.status, 'approved')));
  return subs.map(s => s.circleId);
}

function getCircleCondition(approvedCircleIds: number[] | null, column: any) {
  if (approvedCircleIds === null) return undefined;
  if (approvedCircleIds.length === 0) return sql`1 = 0`;
  return inArray(column, approvedCircleIds);
}

async function resolveCircleId(circleName: string): Promise<number | null> {
  const row = await db.select({ id: circles.id }).from(circles).where(eq(circles.name, circleName)).limit(1);
  return row[0]?.id ?? null;
}

async function resolvePSIds(psArr: string[]): Promise<number[]> {
  const rows = await db.select({ id: policeStations.id }).from(policeStations).where(inArray(policeStations.name, psArr));
  return rows.map(r => r.id);
}

async function buildConditions(c: any, user: any, ignoreDateFilters = false) {
  const approvedCircleIds = await getUserApprovedCircleIds(user);
  const circleCond = getCircleCondition(approvedCircleIds, binData.circleId);

  const conditions: any[] = [];
  if (circleCond) conditions.push(circleCond);

  const status = c.req.query('status');
  const forced = c.req.query('forcedRegistration');
  const majorArea = c.req.query('majorArea');
  const mfgArea = c.req.query('manufacturingArea');
  const srvArea = c.req.query('serviceArea');
  const circle = c.req.query('circle') || c.req.query('circles');
  const year = c.req.query('year');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const policeStationsStr = c.req.query('policeStations') || c.req.query('policeStation');
  const q = c.req.query('q');

  if (status && status !== 'All') {
    const arr = status.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (arr.length > 0) conditions.push(inArray(binData.binStatus, arr));
  }
  if (forced && forced !== 'All') {
    const arr = forced.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (arr.length > 0) conditions.push(inArray(binData.forcedRegistration, arr));
  }
  if (majorArea && majorArea !== 'All') conditions.push(eq(binData.majorAreaOfEconomicActivity, majorArea));
  if (mfgArea && mfgArea !== 'All') conditions.push(eq(binData.areasOfManufacturing, mfgArea));
  if (srvArea && srvArea !== 'All') conditions.push(eq(binData.areasOfService, srvArea));

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

    const [circlesList, policeStationsList, statuses, forcedRegistrations, yearsResult, [totalRows]] = await Promise.all([
      db.selectDistinct({ circle: circles.name }).from(binData)
        .leftJoin(circles, eq(binData.circleId, circles.id))
        .where(and(isNotNull(binData.circleId), circleCondition)),
      db.selectDistinct({ policeStation: policeStations.name }).from(policeStations)
        .leftJoin(circles, eq(policeStations.circleId, circles.id))
        .where(and(
          sql`${policeStations.name} IS NOT NULL AND ${policeStations.name} != ''`,
          psCircleCondition,
          filterCircle && filterCircle !== 'All' 
            ? inArray(circles.name, filterCircle.split(',').map((s:string) => s.trim()).filter(Boolean)) 
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
      db.select({ total: sql<number>`cast(count(${binData.id}) as integer)` }).from(binData).where(circleCondition)
    ]);

    return c.json({
      total: totalRows?.total || 0,
      circles: circlesList.map(c => c.circle).filter(Boolean).sort(),
      policeStations: policeStationsList.map(p => p.policeStation).sort(),
      statuses: statuses.map(s => s.binStatus).sort(),
      forcedRegistrations: forcedRegistrations.map(f => f.forcedRegistration).sort(),
      years: yearsResult.map(y => Math.floor(y.year).toString())
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch filters' }, 500);
  }
};

export const allStats: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
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

    return c.json({
      summary: summaryRow || { total: 0, active: 0, suspended: 0, forced: 0, cancelled: 0 },
      charts: {
        status: statusResult,
        majorArea: majorAreaResult,
        mfgArea: mfgResult,
        srvArea: srvResult,
        pivot: pivotResult,
        trend: trendResult
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
};

const DEFAULTS: Record<string, string> = {
  max_file_size_mb: '2',
  max_file_rows: '10000',
  bin_format_regex: '^[0-9]{9}-[0-9]{4}$',
  bin_format_description: '000000000-0000',
};

function setting(map: Record<string, string>, key: string): string {
  return map[key] ?? DEFAULTS[key] ?? '';
}

const DEFAULT_MODULE_MAPPINGS: Record<string, Record<string, string>> = {
  bin_analyser: {
    bin_issue_date: 'BIN Issue Date',
    division: 'Division',
    circle: 'Circle',
    bin: 'BIN',
    entity_name: 'Name',
    address: 'Factory / Business Operation Address',
    police_station: 'Police Station',
    mobile: 'Mobile Number',
    email: 'Email',
    hq_address: 'Registered HQ Address',
    forced_registration: 'Forced Registration',
    major_area: 'Major Area of Economic Activity',
    manufacturing_area: 'Areas of Manufacturing',
    service_area: 'Areas of Service',
    bin_status: 'BIN Status',
    e_tin: 'e-TIN',
  }
};

async function ensureDefaultMappings(moduleName: string) {
  const existing = await db.query.columnMappings.findMany({
    where: (mappings: any, { or, eq }: any) => or(eq(mappings.module, moduleName), eq(mappings.module, 'bin'))
  });
  if (existing.length === 0 && (DEFAULT_MODULE_MAPPINGS as any)[moduleName]) {
    const toInsert = Object.entries((DEFAULT_MODULE_MAPPINGS as any)[moduleName]).map(([dbColumn, excelHeader]) => ({
      module: moduleName,
      dbColumn,
      excelHeader: excelHeader as string,
    }));
    await db.insert(columnMappings).values(toInsert).catch(() => {});
  }
}

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
    const rawSize = cfg['common_max_file_size_mb'] || cfg['max_file_size_mb'];
    const maxSizeMb = rawSize ? parseFloat(rawSize) : 50;
    const rawRows = cfg['common_max_file_rows'] || cfg['max_file_rows'];
    const maxRows = rawRows ? parseInt(rawRows, 10) : 100000;

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

    await ensureDefaultMappings('bin_analyser').catch(() => {});
    let dbMappings = await db.query.columnMappings.findMany({
      where: (mappings: any, { or, eq }: any) => or(eq(mappings.module, 'bin_analyser'), eq(mappings.module, 'bin'))
    });

    if (dbMappings.length === 0) {
      dbMappings = Object.entries(DEFAULT_MODULE_MAPPINGS['bin_analyser']).map(([dbColumn, excelHeader]) => ({
        id: 0,
        module: 'bin_analyser',
        dbColumn,
        excelHeader: excelHeader as string,
        createdAt: new Date(),
      }));
    }

    const mappingValues = dbMappings.map((m: any) => (m.excelHeader || '').trim().toLowerCase()).filter(Boolean);

    let headerRowIndex = 0;
    let maxMatches = 0;
    for (let i = 0; i < Math.min(20, rawMatrix.length); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      let matches = 0;
      for (const cell of row) {
        if (typeof cell === 'string') {
          const cleanCell = cell.replace(/\r?\n|\r/g, ' ').trim().toLowerCase();
          if (mappingValues.includes(cleanCell)) matches++;
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
            const dObj = rowArrDates[j] as Date;
            const yyyy = dObj.getUTCFullYear();
            const mm = String(dObj.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(dObj.getUTCDate()).padStart(2, '0');
            cellValue = `${yyyy}-${mm}-${dd}`;
          }
          rowObj[cleanHeader] = cellValue;
        }
      }
      rawData.push(rowObj);
    }

    const processedData = [];
    for (const row of rawData) {
      const mappedRow: any = {};
      let hasValidData = false;
      if (dbMappings.length > 0) {
        dbMappings.forEach((mapping: any) => {
          const targetHeaders = mapping.excelHeader.split(',').map((s: string) => s.trim().toLowerCase());
          const combinedValues: string[] = [];
          targetHeaders.forEach((th: string) => {
            const rowKey = Object.keys(row).find(k => k.trim().toLowerCase() === th);
            if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== '') {
              const valStr = String(row[rowKey]).trim();
              if (!combinedValues.includes(valStr)) {
                combinedValues.push(valStr);
              }
            }
          });
          if (combinedValues.length > 0) {
            const val = combinedValues.join(', ');
            mappedRow[mapping.dbColumn] = val;

            // Map both snake_case and camelCase keys for UI and backend saving compatibility
            if (mapping.dbColumn === 'bin_issue_date' || mapping.dbColumn === 'binIssueDate') {
              mappedRow.bin_issue_date = val;
              mappedRow.binIssueDate = val;
            }
            if (mapping.dbColumn === 'division') mappedRow.division = val;
            if (mapping.dbColumn === 'circle') mappedRow.circle = val;
            if (mapping.dbColumn === 'bin') mappedRow.bin = val;
            if (mapping.dbColumn === 'entity_name' || mapping.dbColumn === 'entityName') {
              mappedRow.entity_name = val;
              mappedRow.entityName = val;
            }
            if (mapping.dbColumn === 'address') mappedRow.address = val;
            if (mapping.dbColumn === 'police_station' || mapping.dbColumn === 'policeStation') {
              mappedRow.police_station = val;
              mappedRow.policeStation = val;
            }
            if (mapping.dbColumn === 'mobile') mappedRow.mobile = val;
            if (mapping.dbColumn === 'email') mappedRow.email = val;
            if (mapping.dbColumn === 'hq_address' || mapping.dbColumn === 'hqAddress') {
              mappedRow.hq_address = val;
              mappedRow.hqAddress = val;
            }
            if (mapping.dbColumn === 'forced_registration' || mapping.dbColumn === 'forcedRegistration') {
              mappedRow.forced_registration = val;
              mappedRow.forcedRegistration = val;
            }
            if (mapping.dbColumn === 'major_area' || mapping.dbColumn === 'majorAreaOfEconomicActivity') {
              mappedRow.major_area = val;
              mappedRow.majorAreaOfEconomicActivity = val;
            }
            if (mapping.dbColumn === 'manufacturing_area' || mapping.dbColumn === 'areasOfManufacturing') {
              mappedRow.manufacturing_area = val;
              mappedRow.areasOfManufacturing = val;
            }
            if (mapping.dbColumn === 'service_area' || mapping.dbColumn === 'areasOfService') {
              mappedRow.service_area = val;
              mappedRow.areasOfService = val;
            }
            if (mapping.dbColumn === 'bin_status' || mapping.dbColumn === 'binStatus') {
              mappedRow.bin_status = val;
              mappedRow.binStatus = val;
            }
            if (mapping.dbColumn === 'e_tin' || mapping.dbColumn === 'eTin') {
              mappedRow.e_tin = val;
              mappedRow.eTin = val;
            }

            hasValidData = true;
          }
        });
      } else {
        hasValidData = true;
      }
      if (!hasValidData) continue;
      mappedRow.rawJson = JSON.stringify(row);
      mappedRow.tempId = Math.random().toString(36).substr(2, 9);
      processedData.push(mappedRow);
    }

    return c.json({ message: 'File processed successfully.', data: processedData });
  } catch (error: any) {
    console.error('Parse Error:', error);
    return c.json({ error: error?.message || 'Failed to process file.' }, 500);
  }
};

export const save: Handler = async (c: any) => {
  try {
    const { data } = await c.req.json();
    if (!data || !Array.isArray(data) || data.length === 0) {
      return c.json({ error: 'No data provided to save.' }, 400);
    }

    const cfg = await getSettings(['bin_format_regex', 'bin_format_description', 'bin_date_format']);
    const dateFormat = setting(cfg, 'bin_date_format') || 'DD/MM/YYYY';

    let [existingDivisions, existingCircles, existingPoliceStations] = await Promise.all([
      db.query.divisions.findMany(),
      db.query.circles.findMany(),
      db.query.policeStations.findMany(),
    ]);

    const uniqueDivisions = new Set<string>();
    const uniqueCircles = new Map<string, { circleName: string; divisionName: string }>();
    const uniquePS = new Map<string, { psName: string; circleName: string; divisionName: string }>();

    const user = c.get('auth');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const approvedCircleIds = await getUserApprovedCircleIds(user);

    data.forEach((row: any) => {
      const divisionName = (row.division || row.division_name)?.trim() ?? null;
      const circleName = (row.circle || row.circle_name)?.trim() ?? null;
      const psName = (row.policeStation || row.police_station)?.trim() ?? null;
      if (divisionName) uniqueDivisions.add(divisionName);
      if (divisionName && circleName) {
        uniqueCircles.set(`${divisionName}-${circleName}`, { circleName, divisionName });
        if (psName) uniquePS.set(`${divisionName}-${circleName}-${psName}`, { psName, circleName, divisionName });
      }
    });

    const missingDivs = Array.from(uniqueDivisions).filter(div => !existingDivisions.some((d: any) => d.name.toLowerCase() === div.toLowerCase()));
    if (missingDivs.length > 0) {
      await db.insert(divisions).values(missingDivs.map(name => ({ name }))).onConflictDoNothing();
      existingDivisions = await db.query.divisions.findMany();
    }

    const missingCirclesToInsert: any[] = [];
    for (const { circleName, divisionName } of uniqueCircles.values()) {
      const divObj = existingDivisions.find((d: any) => d.name.toLowerCase() === divisionName.toLowerCase());
      if (divObj && !existingCircles.some((c: any) => c.name.toLowerCase() === circleName.toLowerCase() && c.divisionId === divObj.id)) {
        missingCirclesToInsert.push({ name: circleName, divisionId: divObj.id });
      }
    }
    if (missingCirclesToInsert.length > 0) {
      await db.insert(circles).values(missingCirclesToInsert).onConflictDoNothing();
      existingCircles = await db.query.circles.findMany();
    }

    const missingPSToInsert: any[] = [];
    for (const { psName, circleName, divisionName } of uniquePS.values()) {
      const divObj = existingDivisions.find((d: any) => d.name.toLowerCase() === divisionName.toLowerCase());
      if (divObj) {
        const circleObj = existingCircles.find((c: any) => c.name.toLowerCase() === circleName.toLowerCase() && c.divisionId === divObj.id);
        if (circleObj && !existingPoliceStations.some((ps: any) => ps.name.toLowerCase() === psName.toLowerCase() && ps.circleId === circleObj.id)) {
          missingPSToInsert.push({ name: psName, circleId: circleObj.id, divisionId: divObj.id });
        }
      }
    }
    if (missingPSToInsert.length > 0) {
      await db.insert(policeStations).values(missingPSToInsert).onConflictDoNothing();
      existingPoliceStations = await db.query.policeStations.findMany();
    }

    const ALLOWED_BIN_STATUS = ['Active', 'Suspended', 'Cancelled'];
    const ALLOWED_FORCED = ['Yes', 'No'];

    const toInsert = data.map((row: any) => {
      const binStatusVal = row.binStatus || row.bin_status;
      const binStatus = ALLOWED_BIN_STATUS.includes(binStatusVal) ? binStatusVal : 'Active';
      const forcedVal = row.forcedRegistration || row.forced_registration;
      const forcedRegistration = ALLOWED_FORCED.includes(forcedVal) ? forcedVal : 'No';

      const rawDate = row.binIssueDate || row.bin_issue_date;
      let issueDate = null;
      if (rawDate) {
        if (typeof rawDate === 'string') {
          if (rawDate.includes('T') && rawDate.endsWith('Z')) {
            issueDate = new Date(rawDate);
          } else {
            let y = 0, m = -1, d = 0;
            let separator = null;
            if (rawDate.includes('-')) separator = '-';
            else if (rawDate.includes('/')) separator = '/';
            else if (rawDate.includes('.')) separator = '.';
            
            if (separator) {
              const parts = rawDate.split(separator).map((p: string) => p.trim());
              if (parts.length >= 3) {
                if (parts[0].length === 4) {
                  y = parseInt(parts[0], 10);
                  m = parseInt(parts[1], 10) - 1;
                  d = parseInt(parts[2], 10);
                } else {
                  if (dateFormat === 'MM/DD/YYYY') {
                    m = parseInt(parts[0], 10) - 1;
                    d = parseInt(parts[1], 10);
                    y = parseInt(parts[2], 10);
                  } else {
                    d = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10) - 1;
                    y = parseInt(parts[2], 10);
                  }
                }
                if (y < 100) y += 2000;
              }
            }
            if (y > 0 && d > 0 && m >= 0) {
              issueDate = new Date(Date.UTC(y, m, d));
            }
          }
        }
      }

      let divisionId: number | null = null;
      const divName = (row.division || row.division_name)?.trim();
      if (divName) {
        const d = existingDivisions.find((d: any) => d.name.toLowerCase() === divName.toLowerCase());
        if (d) divisionId = d.id;
      }

      let circleId: number | null = null;
      const circName = (row.circle || row.circle_name)?.trim();
      if (circName) {
        if (divisionId) {
          const c = existingCircles.find((c: any) => c.name.toLowerCase() === circName.toLowerCase() && c.divisionId === divisionId);
          if (c) circleId = c.id;
        } else {
          const matchingCircles = existingCircles.filter((c: any) => c.name.toLowerCase() === circName.toLowerCase());
          if (matchingCircles.length === 1) circleId = matchingCircles[0]?.id || null;
        }
      }

      let policeStationId: number | null = null;
      const psName = (row.policeStation || row.police_station)?.trim();
      if (psName) {
        const ps = existingPoliceStations.find((p: any) => p.name.toLowerCase() === psName.toLowerCase() && p.circleId === circleId)
          || existingPoliceStations.find((p: any) => p.name.toLowerCase() === psName.toLowerCase());
        if (ps) policeStationId = ps.id;
      }

      return {
        bin: row.bin || null,
        entityName: row.entityName || row.entity_name || null,
        binIssueDate: issueDate,
        binStatus,
        forcedRegistration,
        majorAreaOfEconomicActivity: row.majorAreaOfEconomicActivity || row.major_area || null,
        areasOfManufacturing: row.areasOfManufacturing || row.manufacturing_area || null,
        areasOfService: row.areasOfService || row.service_area || null,
        email: row.email || null,
        mobile: row.mobile || null,
        address: row.address || null,
        hqAddress: row.hqAddress || row.hq_address || null,
        divisionId,
        circleId,
        policeStationId,
        eTin: row.eTin || row.e_tin || null,
        rawJson: row.rawJson || null,
        uploadedBy: user?.id ?? null
      };
    });

    const validToInsert = toInsert.filter(row => {
      if (approvedCircleIds === null) return true;
      return row.circleId && approvedCircleIds.includes(row.circleId);
    });

    const binRegexStr = setting(cfg, 'bin_format_regex');
    const binRegex = binRegexStr ? new RegExp(binRegexStr) : null;
    const binDescription = setting(cfg, 'bin_format_description');
    
    if (binRegex) {
      const invalidBins = validToInsert.filter(row => row.bin && !binRegex.test(row.bin));
      if (invalidBins.length > 0) {
        return c.json({
          error: `${invalidBins.length} row(s) have an invalid BIN format. Expected format: ${binDescription}`,
          invalidBins: invalidBins.map(r => r.bin)
        }, 400);
      }
    }

    if (validToInsert.length === 0) {
      return c.json({ error: 'None of the uploaded rows correspond to your approved offices. Please ensure your Excel file contains the exact Circle spelling (e.g., "B Baria Sadar") and that the "Circle" column is correctly mapped in Settings.' }, 400);
    }

    await db.insert(binData).values(validToInsert).onConflictDoUpdate({
      target: binData.bin,
      set: {
        entityName: sql`EXCLUDED.entity_name`,
        binIssueDate: sql`EXCLUDED.bin_issue_date`,
        binStatus: sql`EXCLUDED.bin_status`,
        forcedRegistration: sql`EXCLUDED.forced_registration`,
        majorAreaOfEconomicActivity: sql`EXCLUDED.major_area`,
        areasOfManufacturing: sql`EXCLUDED.manufacturing_area`,
        areasOfService: sql`EXCLUDED.service_area`,
        email: sql`EXCLUDED.email`, mobile: sql`EXCLUDED.mobile`,
        address: sql`EXCLUDED.address`,
        hqAddress: sql`EXCLUDED.hq_address`,
        divisionId: sql`EXCLUDED.division_id`,
        circleId: sql`EXCLUDED.circle_id`, policeStationId: sql`EXCLUDED.police_station_id`,
        eTin: sql`EXCLUDED.e_tin`, rawJson: sql`EXCLUDED.raw_json`
      }
    });

    return c.json({ message: 'Data saved to database successfully!', insertedRows: validToInsert.length });
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
    const circle = c.req.query('circle');

    if (isAdmin) {
      // Admin: সব data বা নির্দিষ্ট circle-এর data delete করতে পারবে
      if (circle) {
        const circleId = await resolveCircleId(circle);
        if (!circleId) return c.json({ success: false, message: 'Circle not found' }, 404);
        await db.delete(binData).where(eq(binData.circleId, circleId));
        return c.json({ success: true, message: `Deleted all data for circle: ${circle}` });
      } else {
        await db.delete(binData);
        return c.json({ success: true, message: 'Deleted all BIN data' });
      }
    } else {
      // User: শুধু নিজের upload করা data delete করতে পারবে
      await db.delete(binData).where(eq(binData.uploadedBy, user.id));
      return c.json({ success: true, message: 'Deleted your uploaded BIN data' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ success: false, message: 'Failed to delete data' }, 500);
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

export const duplicates: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const dupMobiles = await db.select({
      mobile: binData.mobile,
      count: sql<number>`cast(count(${binData.id}) as integer)`
    }).from(binData)
      .where(and(whereClause, sql`${binData.mobile} IS NOT NULL AND ${binData.mobile} != ''`))
      .groupBy(binData.mobile)
      .having(sql`count(${binData.id}) > 1`)
      .limit(50);

    const dupNumbers = dupMobiles.map(m => m.mobile).filter(Boolean);
    if (dupNumbers.length === 0) {
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
      .where(and(whereClause, inArray(binData.mobile, dupNumbers)))
      .orderBy(binData.mobile);

    const groupMap = new Map<string, any[]>();
    rows.forEach(r => {
      const mob = r.mobile!;
      if (!groupMap.has(mob)) groupMap.set(mob, []);
      groupMap.get(mob)!.push({
        ...r,
        circle: r.circleName,
        binIssueDate: r.binIssueDate ? new Date(r.binIssueDate.getTime() - (r.binIssueDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null
      });
    });

    const data = Array.from(groupMap.entries()).map(([key, items], idx) => ({
      id: idx + 1,
      reason: `Duplicate Mobile: ${key}`,
      items
    }));

    return c.json({ data });
  } catch (error) {
    console.error('Duplicates error:', error);
    return c.json({ error: 'Failed to fetch duplicates' }, 500);
  }
};

export const exportData: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    const q = c.req.query('q')?.trim();
    if (q) {
      conditions.push(sql`(${binData.bin} ILIKE ${'%' + q + '%'} OR ${binData.entityName} ILIKE ${'%' + q + '%'} OR ${binData.mobile} ILIKE ${'%' + q + '%'})`);
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({
      bin: binData.bin, entityName: binData.entityName,
      binIssueDate: binData.binIssueDate, binStatus: binData.binStatus,
      forcedRegistration: binData.forcedRegistration,
      majorArea: binData.majorAreaOfEconomicActivity,
      mfgArea: binData.areasOfManufacturing,
      srvArea: binData.areasOfService,
      email: binData.email, mobile: binData.mobile, address: binData.address,
      circleName: circles.name, policeStation: policeStations.name, eTin: binData.eTin
    }).from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
      .where(whereClause)
      .limit(10000);

    const headers = ['BIN', 'Name', 'Status', 'Forced', 'Issue Date', 'Circle', 'Police Station', 'Address', 'Mobile', 'Email', 'Major Area', 'Mfg Area', 'Service Area', 'e-TIN'];
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      const row = [
        `"${r.bin || ''}"`,
        `"${(r.entityName || '').replace(/"/g, '""')}"`,
        `"${r.binStatus || ''}"`,
        `"${r.forcedRegistration || ''}"`,
        `"${r.binIssueDate ? new Date(r.binIssueDate).toISOString().split('T')[0] : ''}"`,
        `"${(r.circleName || '').replace(/"/g, '""')}"`,
        `"${(r.policeStation || '').replace(/"/g, '""')}"`,
        `"${(r.address || '').replace(/"/g, '""')}"`,
        `"${r.mobile || ''}"`,
        `"${r.email || ''}"`,
        `"${(r.majorArea || '').replace(/"/g, '""')}"`,
        `"${(r.mfgArea || '').replace(/"/g, '""')}"`,
        `"${(r.srvArea || '').replace(/"/g, '""')}"`,
        `"${r.eTin || ''}"`
      ];
      csvRows.push(row.join(','));
    }

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="bin_export.csv"');
    return c.text(csvRows.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'Failed to export data' }, 500);
  }
};

