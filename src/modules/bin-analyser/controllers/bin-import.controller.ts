import type { Handler } from "hono";
import { db, cache, storage } from "@/framework/facade.js";
import { eq, sql } from "drizzle-orm";
import { columnMappings, binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import { circles, policeStations, divisions } from "@/modules/settings/database/models/settings.js";
import { getSettings, getUserApprovedCircleIds, resolveCircleId } from "@/modules/bin-analyser/utils/helpers.js";
import { type BulkValue, bulkCopySupported, copyUpsert } from "@/database/bulk-copy.js";
import { parseBinWorkbook, isParseError } from "@/modules/bin-analyser/utils/parse-worker.js";
import { enqueueJob } from "@/modules/jobs/services/job-runner.js";
import { BIN_IMPORT_JOB } from "@/modules/jobs/services/job-types.js";
import { schedulePostImportMaintenance } from "@/modules/jobs/services/maintenance-job.js";

/**
 * §3.3 — Column contract for the BIN COPY fast path. `columns` order must match
 * `toBinDataCopyRow`; the conflict target mirrors the model's unique `bin`;
 * `updateColumns` mirrors the previous `onConflictDoUpdate` set (note
 * `uploaded_by` is intentionally not overwritten on update).
 */
export const BIN_DATA_COPY = {
  stagingTable: "bin_data_staging",
  targetTable: "bin_data",
  conflictColumns: ["bin"],
  columns: [
    "bin",
    "entity_name",
    "bin_issue_date",
    "bin_status",
    "forced_registration",
    "major_area",
    "manufacturing_area",
    "service_area",
    "major_areas",
    "manufacturing_areas",
    "service_areas",
    "email",
    "mobile",
    "address",
    "hq_address",
    "circle_id",
    "division_id",
    "police_station_id",
    "e_tin",
    "raw_json",
    "uploaded_by"
  ],
  updateColumns: [
    "entity_name",
    "bin_issue_date",
    "bin_status",
    "forced_registration",
    "major_area",
    "manufacturing_area",
    "service_area",
    "major_areas",
    "manufacturing_areas",
    "service_areas",
    "email",
    "mobile",
    "address",
    "hq_address",
    "division_id",
    "circle_id",
    "police_station_id",
    "e_tin",
    "raw_json"
  ]
} as const;

/** Project a cleaned BIN row object into the `BIN_DATA_COPY.columns` order. */
export function toBinDataCopyRow(row: any): BulkValue[] {
  return [
    row.bin ?? null,
    row.entityName ?? null,
    row.binIssueDate ?? null,
    row.binStatus ?? null,
    row.forcedRegistration ?? null,
    row.majorAreaOfEconomicActivity ?? null,
    row.areasOfManufacturing ?? null,
    row.areasOfService ?? null,
    row.majorAreas ?? null,
    row.manufacturingAreas ?? null,
    row.serviceAreas ?? null,
    row.email ?? null,
    row.mobile ?? null,
    row.address ?? null,
    row.hqAddress ?? null,
    row.circleId ?? null,
    row.divisionId ?? null,
    row.policeStationId ?? null,
    row.eTin ?? null,
    row.rawJson ?? null,
    row.uploadedBy ?? null
  ];
}

/**
 * Why: §2.3/§2.4/§3.1 — any BIN mutation changes the derived area dimension
 *      table and every dashboard cache. Cache purging stays inline (so the next
 *      request never serves a pre-mutation payload), while the heavier dimension
 *      rebuild and dropdown warm are deferred to a background job.
 * When: At the end of a successful import or delete.
 * Where: bin-import controller mutation paths.
 * How: Purge related cache keys immediately, then enqueue post-import
 *      maintenance (rebuild dimension -> purge again -> warm).
 */
async function afterBinMutation(): Promise<void> {
  await cache.forgetPattern("bin:*");
  await cache.forgetPattern("return-data:*");
  await schedulePostImportMaintenance("bin");
}

const DEFAULTS: Record<string, string> = {
  max_file_size_mb: '2',
  max_file_rows: '10000',
  bin_format_regex: '^[0-9]{9}-[0-9]{4}$',
  bin_format_description: '000000000-0000',
};

function setting(map: Record<string, string>, key: string): string {
  return map[key] ?? DEFAULTS[key] ?? '';
}

/**
 * Why: The activity columns are stored as semicolon-joined text, but the dashboards
 *      filter them with array overlap (`*_areas && ARRAY[...]`) backed by GIN indexes.
 * When: On every BIN import row (kept byte-for-byte in sync with the model's
 *       `binDataPerfHook` backfill so old and new rows behave identically).
 * What: Splits on `;`, trims, drops blanks/None/N/A, de-duplicates and sorts.
 * Returns: A sorted unique token array, or null when there are no usable tokens
 *          (mirrors `array_agg(...)` returning NULL in the backfill).
 */
function splitAreas(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const tokens = Array.from(
    new Set(
      value
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s !== '' && s !== 'None' && s !== 'N/A')
    )
  ).sort();
  return tokens.length > 0 ? tokens : null;
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

    // §3.2 — offload read + mapping to a worker thread (keeps the event loop free).
    const parsed = await parseBinWorkbook({
      buffer,
      mappings: dbMappings.map((m: any) => ({ dbColumn: m.dbColumn, excelHeader: m.excelHeader })),
      maxRows,
    });

    if (isParseError(parsed)) {
      switch (parsed.code) {
        case 'NO_SHEET':
          return c.json({ error: 'No sheets found in Excel file.' }, 400);
        case 'NO_WORKSHEET':
          return c.json({ error: 'Sheet could not be read.' }, 400);
        case 'EMPTY':
          return c.json({ error: 'The uploaded file is empty.' }, 400);
        case 'TOO_MANY_ROWS':
          return c.json({ error: `File contains too many rows. Maximum allowed is ${maxRows.toLocaleString()} data rows.` }, 400);
        default:
          throw new Error(parsed.message || 'Failed to process file.');
      }
    }

    return c.json({ message: 'File processed successfully.', data: parsed.data });
  } catch (error: any) {
    console.error('Parse Error:', error);
    return c.json({ error: error?.message || 'Failed to process file.' }, 500);
  }
};

/**
 * §3.1 — Opt-in asynchronous BIN import. Stores the upload on the tmp disk and
 * returns a job id immediately; the `bin_import` job runs the same parse+save
 * pipeline in the background. Clients poll `GET /api/jobs/:id`.
 */
export const importAsync: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

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

    const cfg = await getSettings(['common_max_file_size_mb', 'max_file_size_mb']);
    const rawSize = cfg['common_max_file_size_mb'] || cfg['max_file_size_mb'];
    const maxSizeMb = rawSize ? parseFloat(rawSize) : 50;
    if (file.size > maxSizeMb * 1024 * 1024) {
      return c.json({ error: `File size exceeds the maximum allowed ${maxSizeMb}MB.` }, 400);
    }

    const fileKey = await storage.disk('tmp').putFile('imports', file);
    const jobId = await enqueueJob(
      BIN_IMPORT_JOB,
      { fileKey, fileName: file.name, mimeType: file.type, createdBy: user.id },
      { createdBy: user.id, maxAttempts: 2 }
    );

    return c.json({ message: 'Import queued.', jobId, status: 'pending', statusUrl: `/api/jobs/${jobId}` }, 202);
  } catch (error: any) {
    console.error('Async Import Error:', error);
    return c.json({ error: 'Failed to queue import.' }, 500);
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
        majorAreas: splitAreas(row.majorAreaOfEconomicActivity || row.major_area),
        manufacturingAreas: splitAreas(row.areasOfManufacturing || row.manufacturing_area),
        serviceAreas: splitAreas(row.areasOfService || row.service_area),
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

    // Deduplicate within the uploaded batch by BIN to prevent PostgreSQL:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" (error 21000)
    const deduplicatedMap = new Map<string, typeof validToInsert[0]>();
    let skippedRowsWithoutBin = 0;
    for (const row of validToInsert) {
      if (row.bin) {
        deduplicatedMap.set(row.bin.trim(), row);
      } else {
        skippedRowsWithoutBin++;
      }
    }
    const deduplicatedRows = Array.from(deduplicatedMap.values());

    if (deduplicatedRows.length === 0) {
      return c.json({
        error: 'No rows contained a BIN value. Please ensure the "BIN" column is correctly mapped in Settings before saving.'
      }, 400);
    }

    if (bulkCopySupported()) {
      // §3.3 — One COPY into the UNLOGGED staging table + a single set-based merge.
      await copyUpsert({
        stagingTable: BIN_DATA_COPY.stagingTable,
        targetTable: BIN_DATA_COPY.targetTable,
        columns: [...BIN_DATA_COPY.columns],
        conflictColumns: [...BIN_DATA_COPY.conflictColumns],
        updateColumns: [...BIN_DATA_COPY.updateColumns],
        rows: deduplicatedRows.map(toBinDataCopyRow)
      });
    } else {
      // Fallback for non-PostgreSQL dialects: atomic, flush-deferred batched upsert.
      const batchSize = 500;
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL synchronous_commit = off`);
        for (let i = 0; i < deduplicatedRows.length; i += batchSize) {
          const batch = deduplicatedRows.slice(i, i + batchSize);
          await tx
            .insert(binData)
            .values(batch)
            .onConflictDoUpdate({
              target: binData.bin,
              set: {
                entityName: sql`EXCLUDED.entity_name`,
                binIssueDate: sql`EXCLUDED.bin_issue_date`,
                binStatus: sql`EXCLUDED.bin_status`,
                forcedRegistration: sql`EXCLUDED.forced_registration`,
                majorAreaOfEconomicActivity: sql`EXCLUDED.major_area`,
                areasOfManufacturing: sql`EXCLUDED.manufacturing_area`,
                areasOfService: sql`EXCLUDED.service_area`,
                majorAreas: sql`EXCLUDED.major_areas`,
                manufacturingAreas: sql`EXCLUDED.manufacturing_areas`,
                serviceAreas: sql`EXCLUDED.service_areas`,
                email: sql`EXCLUDED.email`,
                mobile: sql`EXCLUDED.mobile`,
                address: sql`EXCLUDED.address`,
                hqAddress: sql`EXCLUDED.hq_address`,
                divisionId: sql`EXCLUDED.division_id`,
                circleId: sql`EXCLUDED.circle_id`,
                policeStationId: sql`EXCLUDED.police_station_id`,
                eTin: sql`EXCLUDED.e_tin`,
                rawJson: sql`EXCLUDED.raw_json`
              }
            });
        }
      });
    }

    await afterBinMutation();
    return c.json({ message: 'Data saved to database successfully!', insertedRows: deduplicatedRows.length, skippedRowsWithoutBin });
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
      if (circle) {
        const circleId = await resolveCircleId(circle);
        if (!circleId) return c.json({ success: false, message: 'Circle not found' }, 404);

        // Check if return data exists for this circle
        const circleReturnCountRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(returnData)
          .where(eq(returnData.circleId, circleId));
        const circleReturnCount = Number(circleReturnCountRes[0]?.count || 0);

        if (circleReturnCount > 0) {
          return c.json({
            success: false,
            message: `রিটার্ন ডাটা বিদ্যমান থাকায় সার্কেল "${circle}" এর বিন ডাটা ডিলিট করা যাবে না। প্রথমে রিটার্ন ডাটা ডিলিট করুন। (Cannot delete BIN data for circle "${circle}" because ${circleReturnCount} return records exist. Please delete return data first.)`
          }, 400);
        }

        await db.delete(binData).where(eq(binData.circleId, circleId));
        await afterBinMutation();
        return c.json({ success: true, message: `Deleted all data for circle: ${circle}` });
      } else {
        // Check if any return data exists in the entire system
        const totalReturnCountRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(returnData);
        const totalReturnCount = Number(totalReturnCountRes[0]?.count || 0);

        if (totalReturnCount > 0) {
          return c.json({
            success: false,
            message: `সিস্টেমে ${totalReturnCount}টি রিটার্ন ডাটা বিদ্যমান থাকায় বিন ডাটা ডিলিট করা যাবে না। প্রথমে রিটার্ন ডাটা ডিলিট করুন। (Cannot delete BIN data because ${totalReturnCount} return records exist. Please delete return data first.)`
          }, 400);
        }

        await db.delete(binData);
        await afterBinMutation();
        return c.json({ success: true, message: 'Deleted all BIN data' });
      }
    } else {
      // Non-admin user: check if any returns exist for BINs uploaded by this user
      const userReturnCountRes = await db.execute(sql`
        SELECT count(*) as cnt 
        FROM "return_data" 
        WHERE "bin" IN (
          SELECT "bin" FROM "bin_data" WHERE "uploaded_by" = ${user.id}
        )
      `);
      const userReturnCount = Number((userReturnCountRes as any).rows?.[0]?.cnt || 0);

      if (userReturnCount > 0) {
        return c.json({
          success: false,
          message: `আপনার আপলোডকৃত বিনের বিপরীতে রিটার্ন ডাটা বিদ্যমান থাকায় বিন ডাটা ডিলিট করা যাবে না। প্রথমে সংশ্লিষ্ট রিটার্ন ডাটা ডিলিট করুন।`
        }, 400);
      }

      await db.delete(binData).where(eq(binData.uploadedBy, user.id));
      await afterBinMutation();
      return c.json({ success: true, message: 'Deleted your uploaded BIN data' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ success: false, message: 'Failed to delete data' }, 500);
  }
};
