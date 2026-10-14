import * as xlsx from 'xlsx';
import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { eq, sql } from "drizzle-orm";
import { columnMappings, binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import { circles, policeStations, divisions } from "@/modules/settings/database/models/settings.js";
import { getSettings, getUserApprovedCircleIds, resolveCircleId } from "@/modules/bin-analyser/utils/helpers.js";

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

    // Deduplicate within the uploaded batch by BIN to prevent PostgreSQL:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" (error 21000)
    const deduplicatedMap = new Map<string, typeof validToInsert[0]>();
    for (const row of validToInsert) {
      if (row.bin) {
        deduplicatedMap.set(row.bin.trim(), row);
      }
    }
    const deduplicatedRows = Array.from(deduplicatedMap.values());

    // Batch insert in chunks of 500 to prevent parameter limit overflow and optimize execution
    const batchSize = 500;
    for (let i = 0; i < deduplicatedRows.length; i += batchSize) {
      const batch = deduplicatedRows.slice(i, i + batchSize);
      await db.insert(binData).values(batch).onConflictDoUpdate({
        target: binData.bin,
        set: {
          entityName: sql`EXCLUDED.entity_name`,
          binIssueDate: sql`EXCLUDED.bin_issue_date`,
          binStatus: sql`EXCLUDED.bin_status`,
          forcedRegistration: sql`EXCLUDED.forced_registration`,
          majorAreaOfEconomicActivity: sql`EXCLUDED.major_area`,
          areasOfManufacturing: sql`EXCLUDED.manufacturing_area`,
          areasOfService: sql`EXCLUDED.service_area`,
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

    return c.json({ message: 'Data saved to database successfully!', insertedRows: deduplicatedRows.length });
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
      return c.json({ success: true, message: 'Deleted your uploaded BIN data' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ success: false, message: 'Failed to delete data' }, 500);
  }
};
